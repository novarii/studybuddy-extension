const DEFAULT_EXTENSION_CONFIG = {
  backendBaseUrl: 'http://localhost:4000'
};

const form = document.getElementById('options-form');
const backendInput = document.getElementById('backend-url');
const statusEl = document.getElementById('status');

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_EXTENSION_CONFIG, (config) => {
    backendInput.value = config.backendBaseUrl;
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const backendBaseUrl = backendInput.value.trim();
  if (!backendBaseUrl) {
    statusEl.textContent = 'Backend URL is required.';
    return;
  }

  chrome.storage.sync.set({ backendBaseUrl }, () => {
    statusEl.textContent = 'Saved!';
    setTimeout(() => (statusEl.textContent = ''), 2000);
  });
});

loadSettings();
