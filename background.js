// Background service worker
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showNotification') {
    // Create browser notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Panopto Downloader',
      message: request.message
    });
  }
  return true;
});

// Handle extension icon click (if no popup)
chrome.action.onClicked.addListener((tab) => {
  // Could open options or perform action
});

