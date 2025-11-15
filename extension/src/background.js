const DEFAULT_EXTENSION_CONFIG = {
  backendBaseUrl: 'http://localhost:4000'
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('backendBaseUrl', (result) => {
    if (!result.backendBaseUrl) {
      chrome.storage.sync.set(DEFAULT_EXTENSION_CONFIG);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'UPLOAD_STREAM') {
    return;
  }

  handleUploadRequest(message.payload)
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true;
});

async function handleUploadRequest(payload) {
  if (!payload || !payload.streamUrl) {
    throw new Error('Missing stream URL');
  }

  const config = await getExtensionConfig();
  const endpoint = new URL('/api/extract', config.backendBaseUrl).toString();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Backend error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

function getExtensionConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_EXTENSION_CONFIG, (config) => resolve(config));
  });
}
