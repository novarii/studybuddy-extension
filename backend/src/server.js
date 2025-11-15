import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const TMP_DIR = path.join(__dirname, '..', 'tmp');
const DEFAULT_PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const jobs = new Map();

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/extract', async (req, res) => {
  const { streamUrl, videoId, deliveryParam, deliveryResponse } = req.body || {};

  if (!streamUrl) {
    return res.status(400).json({ error: 'streamUrl is required' });
  }

  const jobId = randomUUID();
  const job = {
    id: jobId,
    streamUrl,
    videoId,
    deliveryParam,
    deliveryResponse,
    status: 'queued',
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  jobs.set(jobId, job);

  res.json({
    jobId,
    statusUrl: `/api/jobs/${jobId}`,
    downloadUrl: `/api/jobs/${jobId}/download`
  });

  processJob(job).catch((error) => {
    console.error(`[Job ${job.id}] failed`, error);
  });
});

app.get('/api/jobs', (_req, res) => {
  res.json({ jobs: Array.from(jobs.values()) });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

app.get('/api/jobs/:id/download', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== 'completed' || !job.outputPath) {
    return res.status(404).json({ error: 'MP3 not ready' });
  }
  res.download(job.outputPath, path.basename(job.outputPath));
});

async function processJob(job) {
  job.status = 'processing';
  job.updatedAt = new Date().toISOString();

  await ensureDirectories();

  const outputName = sanitizeFileName(job.videoId || job.id);
  const outputPath = path.join(OUTPUT_DIR, `${outputName}.mp3`);
  job.outputPath = outputPath;

  const strategy = selectStrategy(job.streamUrl);
  try {
    if (strategy === 'yt-dlp') {
      await downloadWithYtDlp(job.streamUrl, outputPath);
    } else {
      const tmpInput = path.join(TMP_DIR, `${outputName}.mp4`);
      await downloadDirect(job.streamUrl, tmpInput);
      await extractWithFfmpeg(tmpInput, outputPath);
      await safeUnlink(tmpInput);
    }
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    await safeUnlink(job.outputPath);
    console.error(`[Job ${job.id}]`, error.message);
  }

  job.updatedAt = new Date().toISOString();
}

function selectStrategy(streamUrl) {
  if (!streamUrl) {
    return 'direct';
  }
  if (/\.m3u8(\?|$)/.test(streamUrl) || /panobf/i.test(streamUrl)) {
    return 'yt-dlp';
  }
  return 'direct';
}

async function ensureDirectories() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });
}

function sanitizeFileName(value) {
  return (value || 'panopto-audio').replace(/[^a-z0-9-_]/gi, '_');
}

async function downloadWithYtDlp(streamUrl, outputPath) {
  await ensureBinaryAvailable('yt-dlp');
  const args = [
    streamUrl,
    '--no-progress',
    '-f', 'bestaudio/best',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outputPath
  ];

  await runCommand('yt-dlp', args);
}

async function extractWithFfmpeg(inputPath, outputPath) {
  await ensureBinaryAvailable('ffmpeg');
  const args = ['-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', outputPath];
  await runCommand('ffmpeg', args);
}

async function downloadDirect(streamUrl, destination) {
  await new Promise((resolve, reject) => {
    const protocol = streamUrl.startsWith('https') ? https : http;
    const request = protocol.get(streamUrl, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const nextUrl = new URL(response.headers.location, streamUrl).toString();
        response.resume();
        downloadDirect(nextUrl, destination).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(destination);
      response.pipe(fileStream);
      response.on('error', reject);
      fileStream.on('finish', () => fileStream.close(resolve));
      fileStream.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function safeUnlink(filePath) {
  if (!filePath) {
    return;
  }
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to cleanup file', filePath, error.message);
    }
  }
}

async function ensureBinaryAvailable(binary) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const lookup = spawn(cmd, [binary]);
    lookup.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${binary} was not found in PATH`));
      }
    });
  });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

app.use(express.static(OUTPUT_DIR));

app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: err.message });
});

await ensureDirectories();

app.listen(DEFAULT_PORT, () => {
  console.log(`Panopto Audio Extractor backend listening on :${DEFAULT_PORT}`);
});
