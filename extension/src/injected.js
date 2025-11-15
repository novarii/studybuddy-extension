(() => {
  if (window.__PANOPTO_AUDIO_EXTRACTOR_LOADED__) {
    return;
  }
  window.__PANOPTO_AUDIO_EXTRACTOR_LOADED__ = true;

  const EVENT_SOURCE = 'panopto-audio-extractor';
  const REQUEST_TYPE = 'SEND_TO_BACKEND';
  const RESPONSE_TYPE = 'BACKEND_RESPONSE';
  const DELIVERY_ENDPOINT = '/Panopto/Pages/Viewer/DeliveryInfo.aspx';

  const ui = createUi();
  const config = window.__PANOPTO_AUDIO_CONFIG__ || {};

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== EVENT_SOURCE) {
      return;
    }

    if (event.data.type !== RESPONSE_TYPE) {
      return;
    }

    const { success, data, error } = event.data.payload || {};
    if (!success) {
      ui.setError(error || 'Backend request failed');
      return;
    }

    ui.setSuccess(data);
  });

  ui.button.addEventListener('click', async () => {
    if (ui.button.disabled) {
      return;
    }

    ui.setLoading('Fetching stream info…');

    try {
      const context = resolveVideoContext();
      if (!context) {
        throw new Error('Could not detect video id from URL. Is this a viewer page?');
      }

      const deliveryResponse = await fetchDeliveryInfo(context);
      const streamUrl = selectStreamUrl(deliveryResponse);
      if (!streamUrl) {
        throw new Error('Stream URL missing in DeliveryInfo response');
      }

      dispatchToExtension({
        streamUrl,
        videoId: context.value,
        deliveryParam: context.param,
        deliveryResponse,
        requestedAt: new Date().toISOString()
      });
      ui.setLoading('Sending stream to backend…');
    } catch (error) {
      console.error('[PanoptoAudioExtractor]', error);
      ui.setError(error.message || 'Unexpected error');
    }
  });

  function dispatchToExtension(payload) {
    window.postMessage({ source: EVENT_SOURCE, type: REQUEST_TYPE, payload }, '*');
  }

  function resolveVideoContext() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) {
      return { param: 'deliveryId', value: params.get('id') };
    }
    if (params.get('tid')) {
      return { param: 'tid', value: params.get('tid') };
    }
    return null;
  }

  async function fetchDeliveryInfo(context) {
    const formData = new URLSearchParams();
    formData.append(context.param, context.value);
    formData.append('isEmbed', 'true');
    formData.append('responseType', 'json');
    if (context.param === 'tid') {
      formData.append('isLiveNotes', 'false');
      formData.append('refreshAuthCookie', 'true');
      formData.append('isActiveBroadcast', 'false');
      formData.append('isEditing', 'false');
    }

    const response = await fetch(DELIVERY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`DeliveryInfo request failed (${response.status})`);
    }

    const payload = await response.json();
    if (payload.ErrorCode) {
      throw new Error(payload.ErrorMessage || `Panopto responded with ${payload.ErrorCode}`);
    }

    return payload;
  }

  function selectStreamUrl(deliveryResponse) {
    const delivery = deliveryResponse?.Delivery;
    if (!delivery) {
      return null;
    }

    const podcastStream = delivery.PodcastStreams?.find((stream) => !!stream.StreamUrl);
    if (podcastStream) {
      return podcastStream.StreamUrl;
    }

    const videoStream = delivery.Streams?.find((stream) => stream.StreamUrl);
    if (videoStream) {
      return videoStream.StreamUrl;
    }

    return null;
  }

  function createUi() {
    const style = document.createElement('style');
    style.textContent = `
      .panopto-audio-btn {
        position: fixed;
        bottom: 32px;
        right: 32px;
        background: #1f6feb;
        color: white;
        border: none;
        border-radius: 999px;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);
        cursor: pointer;
        z-index: 10000;
      }
      .panopto-audio-btn[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .panopto-audio-status {
        position: fixed;
        bottom: 96px;
        right: 32px;
        max-width: 280px;
        background: rgba(15, 23, 42, 0.9);
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);
        font-size: 0.9rem;
        z-index: 10000;
        display: none;
      }
      .panopto-audio-status.visible {
        display: block;
      }
      .panopto-audio-status a {
        color: #8ad3ff;
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.className = 'panopto-audio-btn';
    button.textContent = 'Download Audio (MP3)';

    const status = document.createElement('div');
    status.className = 'panopto-audio-status';

    document.body.appendChild(button);
    document.body.appendChild(status);

    return {
      button,
      status,
      setLoading(message) {
        button.disabled = true;
        status.textContent = message;
        status.classList.add('visible');
      },
      setError(message) {
        button.disabled = false;
        status.textContent = `⚠️ ${message}`;
        status.classList.add('visible');
      },
      setSuccess(data) {
        button.disabled = false;
        const downloadUrl = data?.downloadUrl;
        if (downloadUrl) {
          status.innerHTML = `✅ Audio ready. <a href="${downloadUrl}" target="_blank" rel="noopener">Download MP3</a>`;
        } else {
          status.textContent = '✅ Request queued. Track status in backend UI.';
        }
        status.classList.add('visible');
      }
    };
  }
})();
