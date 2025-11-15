# Panopto Audio Extractor

Two-part system that lets students extract MP3 audio from Panopto lecture videos by mimicking the platform's own web player workflow.

## Repository Layout

| Path | Description |
| --- | --- |
| `extension/` | Manifest V3 browser extension that runs inside Panopto viewer pages, pulls DeliveryInfo metadata, and forwards usable stream URLs to the backend. |
| `backend/` | Node.js/Express server that receives stream URLs, downloads the source video (via direct HTTP or `yt-dlp`), and extracts MP3 audio with FFmpeg. |

## How It Works

1. The extension injects a small script into Panopto's viewer pages that adds a **Download Audio (MP3)** button.
2. When clicked, it calls `POST /Panopto/Pages/Viewer/DeliveryInfo.aspx` from the page context so session cookies are reused automatically.
3. A usable stream URL is selected from the `PodcastStreams`/`Streams` arrays in the response.
4. The extension sends that stream URL plus lightweight metadata to the backend.
5. The backend downloads the source stream (direct HTTP for MP4, or `yt-dlp` for HLS/`panobf` links), extracts audio with FFmpeg, and exposes a download endpoint for the resulting MP3.

## Extension

- Manifest v3 with a single content script for `*://*/Panopto/Pages/Viewer/*` URLs.
- Content script injects `src/injected.js` into the live page so requests appear same-origin to Panopto.
- `src/injected.js` handles UI, DeliveryInfo POSTs, stream selection, and messaging.
- Background service worker reads the configured backend base URL (stored via `chrome.storage.sync`) and relays stream payloads to `/api/extract`.
- `extension/src/options.html` lets users change the backend base URL (defaults to `http://localhost:4000`).
- Web accessible resource is limited to the injected script to satisfy MV3 CSP requirements.

### Running the Extension

1. Build/zip is not required—load `extension/` as an **Unpacked** extension in Chrome/Edge (Developer Mode).
2. Visit any Panopto viewer page (`.../Panopto/Pages/Viewer.aspx?id=...`).
3. Use the floating **Download Audio (MP3)** button; the status bubble reports DeliveryInfo fetch errors or backend responses.

## Backend

- Node 18+, Express, CORS, and Morgan for logging (`backend/package.json`).
- Stores transient job metadata in memory (`jobs` map) with `/api/jobs/:id` status lookups.
- `/api/extract` validates input, queues an async processor, and returns URLs for polling and downloads.
- Download strategy:
  - **Direct HTTP** for MP4-like URLs → saves to `backend/tmp/`, then runs `ffmpeg -i input -vn -acodec libmp3lame ...` → saves MP3 to `backend/output/`.
  - **`yt-dlp`** for `.m3u8` or `.panobf` URLs → `yt-dlp -x --audio-format mp3 ...` handles fragmented/encrypted cases.
- Files served via `GET /api/jobs/:id/download` (plus a static file server on `/`).
- Requires `yt-dlp` and `ffmpeg` binaries available on `PATH` for full coverage; the server checks and throws descriptive errors if missing.

### Local Setup

```bash
cd backend
npm install          # requires internet access
npm run dev          # starts on http://localhost:4000
```

Environment variables:

- `PORT` – overrides the default `4000` port.

## Key Assumptions & Safeguards

- DeliveryInfo endpoint (`/Panopto/Pages/Viewer/DeliveryInfo.aspx`) stays stable enough for POST payloads described in `src/injected.js`.
- Requests originate from the Panopto page context to reuse session cookies; the extension never handles credentials directly.
- Stream URLs may expire quickly, so backend jobs start immediately after the `POST /api/extract` call.
- Users must already have permission to view the lecture; backend simply mirrors access they already possess.
- `yt-dlp` + FFmpeg cover HLS (`.m3u8`) and encrypted (`.panobf`) cases; direct HTTP fallback handles simpler MP4 URLs to reduce dependency load.

## Next Steps

- Persist job metadata in a lightweight DB or KV store for multi-instance deployments.
- Add auth/rate-limiting on the backend to prevent abuse if exposed publicly.
- Provide richer UI feedback inside the extension (progress polling, error codes, etc.).
- Write automated tests (unit + integration) for DeliveryInfo parsing logic and backend job processor once dependencies are available.
