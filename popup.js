// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const pageInfoDiv = document.getElementById('page-info');
  const sendButton = document.getElementById('send-button');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if we're on a Panopto page
  const isPanoptoPage = tab.url && (
    tab.url.includes('panopto.com') || 
    tab.url.includes('panopto.eu')
  );

  const isViewerPage = tab.url && (
    tab.url.includes('/Viewer.aspx') ||
    tab.url.includes('/Embed.aspx')
  );

  if (!isPanoptoPage) {
    pageInfoDiv.textContent = 'Not on a Panopto page';
    pageInfoDiv.classList.add('error');
    sendButton.disabled = true;
    return;
  }

  if (!isViewerPage) {
    pageInfoDiv.textContent = 'Please navigate to a Panopto video page';
    pageInfoDiv.classList.add('error');
    sendButton.disabled = true;
    return;
  }

  // Extract video info from URL
  const url = new URL(tab.url);
  const videoId = url.searchParams.get('id') || url.searchParams.get('tid');
  
  if (videoId) {
    pageInfoDiv.textContent = `Video ID: ${videoId}`;
  } else {
    pageInfoDiv.textContent = 'Could not detect video ID';
    pageInfoDiv.classList.add('error');
    sendButton.disabled = true;
    return;
  }

  // Handle send button click
  sendButton.addEventListener('click', async () => {
    sendButton.disabled = true;
    showStatus('Getting video link...', 'info');

    try {
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'downloadVideo'
      });

      if (response.success) {
        showStatus(response.message || 'Video sent to Study Buddy! ✓', 'success');
      } else {
        showStatus('Error: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: ' + error.message, 'error');
    } finally {
      setTimeout(() => {
        sendButton.disabled = false;
      }, 2000);
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
