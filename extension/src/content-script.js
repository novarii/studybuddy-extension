const DEFAULT_EXTENSION_CONFIG = {
  backendBaseUrl: 'http://localhost:4000'
};

const BRIDGE_EVENT_SOURCE = 'panopto-audio-extractor';
const BACKGROUND_MESSAGE_TYPE = 'UPLOAD_STREAM';
const PAGE_REQUEST_TYPE = 'SEND_TO_BACKEND';
const PAGE_RESPONSE_TYPE = 'BACKEND_RESPONSE';

function injectInlineConfig(config) {
  const script = document.createElement('script');
  script.id = 'panopto-audio-config';
  script.type = 'text/javascript';
  script.textContent = `window.__PANOPTO_AUDIO_CONFIG__ = ${JSON.stringify(config)};`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function injectBridgeScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/injected.js');
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
}

function subscribeToPageEvents() {
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== BRIDGE_EVENT_SOURCE) {
      return;
    }

    if (event.data.type !== PAGE_REQUEST_TYPE) {
      return;
    }

    chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPE,
      payload: event.data.payload
    }, (response) => {
      const message = {
        source: BRIDGE_EVENT_SOURCE,
        type: PAGE_RESPONSE_TYPE,
        payload: response || { error: chrome.runtime.lastError?.message || 'Unknown error' }
      };
      window.postMessage(message, '*');
    });
  });
}

function bootstrap() {
  chrome.storage.sync.get(DEFAULT_EXTENSION_CONFIG, (config) => {
    injectInlineConfig(config);
    injectBridgeScript();
    subscribeToPageEvents();
  });
}

bootstrap();
