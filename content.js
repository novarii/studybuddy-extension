// Content script - runs on Panopto pages
(function() {
  'use strict';

  // Configuration
  let backendUrl = null;
  let apiKey = null;
  let isInitialized = false;

  // Load settings
  async function loadSettings() {
    const result = await chrome.storage.sync.get(['backendUrl', 'apiKey']);
    backendUrl = result.backendUrl;
    apiKey = result.apiKey;
    return !!backendUrl;
  }

  // Initialize on page load
  async function init() {
    if (isInitialized) return;
    
    const hasSettings = await loadSettings();
    if (!hasSettings) {
      console.warn('Panopto Downloader: Backend URL not configured. Open extension options to set it up.');
      return;
    }

    isInitialized = true;

    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addDownloadButtons);
    } else {
      addDownloadButtons();
    }
  }

  // Add download buttons based on page type
  function addDownloadButtons() {
    const pathname = window.location.pathname;

    if (pathname.includes('/List.aspx')) {
      addListPageButton();
    } else if (pathname.includes('/Viewer.aspx')) {
      addViewerPageButton();
    } else if (pathname.includes('/Embed.aspx')) {
      addEmbedPageButton();
    }
  }

  // Add button to list page (multiple videos)
  function addListPageButton() {
    const actionHeader = document.querySelector('#actionHeader button')?.parentElement;
    if (!actionHeader || document.querySelector('#panopto-dl-list-btn')) return;

    const button = document.createElement('button');
    button.id = 'panopto-dl-list-btn';
    button.className = 'css-t83cx2 css-tr3oo4 css-coghg4';
    button.role = 'button';
    button.style.marginLeft = '0.5rem';
    button.innerHTML = '<span class="material-icons css-6xugel" style="font-size: 18px;margin-bottom:-0.25rem;">file_download</span>Download All';

    button.addEventListener('click', handleListDownload);
    actionHeader.appendChild(button);
  }

  // Add button to viewer page
  function addViewerPageButton() {
    const tabControl = document.querySelector('#eventTabControl');
    if (!tabControl || document.querySelector('#panopto-dl-viewer-btn')) return;

    const button = document.createElement('a');
    button.id = 'panopto-dl-viewer-btn';
    button.href = '#';
    button.innerHTML = '<span class="material-icons" style="font-size:15px;margin-bottom:-0.25rem;">file_download</span> Download';
    button.classList = 'event-tab-header';
    button.style = 'display:inline-flex;align-items:center;position:absolute;bottom:30px;padding:5px 10px;text-decoration:none;cursor:pointer;';

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSingleDownload();
    });

    tabControl.appendChild(button);
  }

  // Add button to embed page
  function addEmbedPageButton() {
    const navControls = document.querySelector('#navigationControls');
    if (!navControls || document.querySelector('#panopto-dl-embed-btn')) return;

    const button = document.createElement('div');
    button.id = 'panopto-dl-embed-btn';
    button.role = 'button';
    button.title = 'Download';
    button.classList = 'button-control material-icons';
    button.innerHTML = '<span class="material-icons">file_download</span>';

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSingleDownload();
    });

    navControls.appendChild(button);
  }

  // Handle single video download
  async function handleSingleDownload() {
    const url = new URL(window.location.href);
    const videoId = url.searchParams.get('id') ?? url.searchParams.get('tid');
    const isTid = url.searchParams.has('tid');

    if (!videoId) {
      showNotification('Failed to get Lesson ID.', 'error');
      return;
    }

    showNotification('Getting video link...', 'info');

    try {
      const streams = await requestDeliveryInfo(videoId, isTid);
      const streamUrl = streams[0];

      await sendToBackend(streamUrl, videoId, document.title, window.location.href);
    } catch (error) {
      console.error('Download error:', error);
      showNotification('Failed to download: ' + error.message, 'error');
    }
  }

  // Handle list page download (multiple videos)
  async function handleListDownload(e) {
    e.preventDefault();
    e.stopPropagation();

    const list = document.querySelectorAll('#listViewContainer tbody > tr a.detail-title').length ?
      document.querySelectorAll('#listViewContainer tbody > tr a.detail-title') :
      document.querySelectorAll('#detailsTable tbody > tr a.detail-title').length ?
      document.querySelectorAll('#detailsTable tbody > tr a.detail-title') :
      document.querySelectorAll('#thumbnailGrid > li a.detail-title').length ?
      document.querySelectorAll('#thumbnailGrid > li a.detail-title') :
      null;

    if (!list || list.length === 0) {
      showNotification('No videos found', 'error');
      return;
    }

    showNotification(`Processing ${list.length} videos...`, 'info');

    const requests = Array.from(list).map(async (item) => {
      const videoId = new URL(item.getAttribute('href')).searchParams.get('id');
      const videoTitle = item.textContent.trim();
      
      try {
        const streams = await requestDeliveryInfo(videoId);
        const streamUrl = streams[0];
        await sendToBackend(streamUrl, videoId, videoTitle, item.getAttribute('href'));
        return { success: true, title: videoTitle };
      } catch (error) {
        console.error(`Failed for ${videoTitle}:`, error);
        return { success: false, title: videoTitle, error: error.message };
      }
    });

    const results = await Promise.allSettled(requests);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    showNotification(
      `Completed: ${successful} successful, ${failed} failed`,
      failed > 0 ? 'warning' : 'success'
    );
  }

  // Request delivery info from Panopto API
  async function requestDeliveryInfo(videoId, isTid = false) {
    const url = `${window.location.origin}/Panopto/Pages/Viewer/DeliveryInfo.aspx`;
    
    const body = isTid 
      ? `&tid=${videoId}&isLiveNotes=false&refreshAuthCookie=true&isActiveBroadcast=false&isEditing=false&isKollectiveAgentInstalled=false&isEmbed=false&responseType=json`
      : `deliveryId=${videoId}&isEmbed=true&responseType=json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.ErrorCode) {
      throw new Error(data.ErrorMessage || 'Unknown error from Panopto API');
    }

    const streamUrl = data.Delivery?.PodcastStreams?.[0]?.StreamUrl;
    const streams = (data.Delivery?.Streams || []).filter(x => x.StreamUrl !== streamUrl);

    if (!streamUrl) {
      throw new Error('Stream URL not available');
    }

    return [streamUrl, streams];
  }

  // Send video to backend
  async function sendToBackend(streamUrl, videoId, title, sourceUrl) {
    if (!backendUrl) {
      throw new Error('Backend URL not configured. Please set it in extension options.');
    }

    const response = await fetch(`${backendUrl}/api/videos/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
      },
      body: JSON.stringify({
        stream_url: streamUrl,
        video_id: videoId,
        title: title || document.title,
        source_url: sourceUrl || window.location.href
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const result = await response.json();
    showNotification('Video sent to backend! Download started.', 'success');
    return result;
  }

  // Show notification
  function showNotification(message, type = 'info') {
    // Send to background script for notification
    chrome.runtime.sendMessage({
      action: 'showNotification',
      message: message,
      type: type
    });

    // Also log to console
    console.log(`[Panopto Downloader] ${message}`);
  }

  // Initialize
  init();

  // Re-initialize if settings change
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.backendUrl || changes.apiKey) {
      isInitialized = false;
      init();
    }
  });
})();

