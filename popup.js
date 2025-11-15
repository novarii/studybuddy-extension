// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const configStatus = document.getElementById('config-status');
  const checkBtn = document.getElementById('check-backend');
  const optionsBtn = document.getElementById('open-options');

  // Load and display config status
  const config = await chrome.storage.sync.get(['backendUrl', 'apiKey']);
  if (config.backendUrl) {
    configStatus.textContent = `Backend: ${config.backendUrl}`;
    configStatus.style.color = '#28a745';
  } else {
    configStatus.textContent = 'Backend not configured';
    configStatus.style.color = '#dc3545';
  }

  // Check backend connection
  checkBtn.addEventListener('click', async () => {
    const config = await chrome.storage.sync.get(['backendUrl', 'apiKey']);
    
    if (!config.backendUrl) {
      showStatus('Please configure backend URL in settings', 'error');
      return;
    }

    try {
      const response = await fetch(`${config.backendUrl}/api/health`, {
        method: 'GET',
        headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        showStatus('Backend is online! ✓', 'success');
      } else {
        showStatus(`Backend error: ${response.status}`, 'error');
      }
    } catch (error) {
      showStatus(`Connection failed: ${error.message}`, 'error');
    }
  });

  // Open options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
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

