// Content script - runs on Panopto pages
(function() {
  'use strict';

  // Configuration
  const DEFAULT_BACKEND_URL = 'http://localhost:8000';

  // Load backend URL (defaults to localhost:8000)
  async function getBackendUrl() {
    const result = await chrome.storage.sync.get(['backendUrl']);
    return result.backendUrl || DEFAULT_BACKEND_URL;
  }

  // Handle single video download
  async function handleSingleDownload() {
    const url = new URL(window.location.href);
    const videoId = url.searchParams.get('id') ?? url.searchParams.get('tid');
    const isTid = url.searchParams.has('tid');

    if (!videoId) {
      return { success: false, error: 'Failed to get Lesson ID.' };
    }

    try {
      const streams = await requestDeliveryInfo(videoId, isTid);
      const streamUrl = streams[0];
      const backendUrl = await getBackendUrl();

      const result = await sendToBackend(streamUrl, videoId, document.title, window.location.href, backendUrl);
      return { success: true, message: 'Video sent to Study Buddy! Download started.' };
    } catch (error) {
      console.error('Download error:', error);
      return { success: false, error: error.message };
    }
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
  async function sendToBackend(streamUrl, videoId, title, sourceUrl, backendUrl) {
    const response = await fetch(`${backendUrl}/api/videos/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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

    return await response.json();
  }

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadVideo') {
      handleSingleDownload().then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Indicates we will send a response asynchronously
    }
  });
})();

