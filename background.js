// Background service worker
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default backend URL
    await chrome.storage.sync.set({
      backendUrl: 'http://localhost:8000'
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showNotification') {
    // Create browser notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Study Buddy',
      message: request.message
    });
  }
  return true;
});

// Handle extension icon click (if no popup)
chrome.action.onClicked.addListener((tab) => {
  // Could open options or perform action
});

