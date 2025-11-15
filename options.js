// Options page script
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form');
  const backendUrlInput = document.getElementById('backendUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const config = await chrome.storage.sync.get(['backendUrl', 'apiKey']);
  if (config.backendUrl) {
    backendUrlInput.value = config.backendUrl;
  }
  if (config.apiKey) {
    apiKeyInput.value = config.apiKey;
  }

  // Save settings
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const backendUrl = backendUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!backendUrl) {
      showStatus('Backend URL is required', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({
        backendUrl: backendUrl,
        apiKey: apiKey || null
      });

      showStatus('Settings saved successfully!', 'success');
      
      // Test connection
      setTimeout(async () => {
        try {
          const response = await fetch(`${backendUrl}/api/health`);
          if (response.ok) {
            showStatus('Settings saved and backend is reachable! ✓', 'success');
          } else {
            showStatus('Settings saved, but backend returned an error', 'error');
          }
        } catch (error) {
          showStatus('Settings saved, but could not reach backend', 'error');
        }
      }, 500);
    } catch (error) {
      showStatus('Failed to save settings: ' + error.message, 'error');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
});

