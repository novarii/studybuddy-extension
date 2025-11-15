# Panopto Video Downloader

Browser extension that lets you download Panopto videos to your backend storage. The extension works on Panopto Viewer, Embed, and List pages, extracting video stream URLs and sending them to your configured backend API.

## Repository Layout

```
panopto-downloader-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── content.js              # Content script injected into Panopto pages
├── background.js           # Background service worker
├── popup.html              # Extension popup UI
├── popup.js                # Popup logic
├── options.html            # Settings page
├── options.js              # Settings logic
├── styles.css              # Shared styles
├── icons/                  # Extension icons
│   ├── icon16.png          # 16x16 icon
│   ├── icon48.png          # 48x48 icon
│   ├── icon128.png         # 128x128 icon
│   └── icon.svg            # Vector icon (optional)
└── README.md
```

## How It Works

1. The extension injects `content.js` into Panopto pages (Viewer, Embed, and List pages).
2. Download buttons are automatically added to the page UI based on the page type.
3. When clicked, the extension calls `POST /Panopto/Pages/Viewer/DeliveryInfo.aspx` from the page context (reusing session cookies automatically).
4. A usable stream URL is extracted from the `PodcastStreams`/`Streams` arrays in the response.
5. The extension sends the stream URL plus metadata (video ID, title, source URL) to your backend at `/api/videos/download`.
6. Your backend receives the request and can download/process the video as needed.

## Features

- ✅ Works on Viewer, Embed, and List pages
- ✅ Single video downloads from viewer/embed pages
- ✅ Batch downloads from list pages (download all videos at once)
- ✅ Configurable backend URL via settings page
- ✅ Optional API key authentication
- ✅ Browser notifications for success/error states
- ✅ Popup for quick backend status check
- ✅ Settings page for configuration

## Installation & Setup

### 1. Add Extension Icons

Before loading the extension, you need to add icon files to the `icons/` directory:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create these using any image editor or icon generator.

### 2. Load the Extension

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select this extension directory

### 3. Configure Backend

On first install, the extension will automatically open the options page. Otherwise:
- Click the extension icon → "Open Settings"
- Or right-click the extension icon → "Options"

Configure:
- **Backend URL** (required): Your backend API endpoint (e.g., `https://api.example.com`)
- **API Key** (optional): If your backend requires Bearer token authentication

### 4. Test the Extension

1. Visit any Panopto video page:
   - Viewer: `https://*.panopto.com/Panopto/Pages/Viewer.aspx?id=...`
   - Embed: `https://*.panopto.com/Panopto/Pages/Embed.aspx?id=...`
   - List: `https://*.panopto.com/Panopto/Pages/Sessions/List.aspx`

2. You should see download buttons:
   - **Viewer/Embed pages**: Download button in the video controls
   - **List pages**: "Download All" button in the action header

3. Click the download button to test the flow

## Backend API Requirements

Your backend should implement the following endpoint:

### `POST /api/videos/download`

**Request Body:**
```json
{
  "stream_url": "https://...",
  "video_id": "abc123",
  "title": "Video Title",
  "source_url": "https://panopto.com/..."
}
```

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <api_key>` (if API key is configured)

**Response:**
- `200 OK` - Success (any JSON response)
- `4xx/5xx` - Error (JSON with `detail` field for error message)

### Optional: `GET /api/health`

The extension popup can check backend connectivity using this endpoint:
- `200 OK` - Backend is online
- Any other status - Backend error

## Extension Architecture

### Content Script (`content.js`)
- Runs on Panopto pages (Viewer, Embed, List)
- Detects page type and adds appropriate download buttons
- Handles DeliveryInfo API requests
- Extracts stream URLs from Panopto responses
- Sends download requests to backend

### Background Service Worker (`background.js`)
- Handles extension lifecycle events
- Opens options page on first install
- Creates browser notifications from content script messages

### Popup (`popup.html` + `popup.js`)
- Quick status check for backend connectivity
- Displays current backend configuration
- Provides quick access to settings

### Options Page (`options.html` + `options.js`)
- Settings UI for backend URL and API key
- Validates and saves configuration
- Tests backend connectivity after saving

## Key Assumptions & Safeguards

- DeliveryInfo endpoint (`/Panopto/Pages/Viewer/DeliveryInfo.aspx`) is stable for POST requests
- Requests originate from the Panopto page context to reuse session cookies automatically
- The extension never handles credentials directly; it relies on existing Panopto session cookies
- Users must already have permission to view the lecture; the extension only mirrors access they already possess
- Stream URLs may expire quickly, so backend should process them immediately

## Permissions

The extension requires:
- `storage` - To save backend URL and API key settings
- `activeTab` - To interact with Panopto pages
- `scripting` - To inject content scripts
- `notifications` - To show download status notifications
- `host_permissions` - Access to `*.panopto.com` and `*.panopto.eu` domains

## Development

### Testing Changes

1. Make your code changes
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the Panopto page to test

### Debugging

- **Content Script**: Use browser DevTools on the Panopto page (Console tab)
- **Background Script**: Go to `chrome://extensions/` → Click "service worker" link under the extension
- **Popup**: Right-click the extension icon → "Inspect popup"
- **Options Page**: Right-click the options page → "Inspect"

## Distribution

### Chrome Web Store
1. Create a ZIP file of the extension directory
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload the ZIP and follow the submission process

### Firefox Add-ons
1. Update `manifest.json` for Firefox compatibility if needed
2. Submit to [Firefox Add-ons](https://addons.mozilla.org/)

### Direct Distribution
- Package as `.crx` file (Chrome) or `.xpi` file (Firefox)
- Distribute directly to users (they'll need to enable Developer Mode to install)

## Next Steps

- Add progress tracking for batch downloads
- Implement retry logic for failed downloads
- Add download history/logging
- Support for additional Panopto domains
- Enhanced error messages and user feedback
- Optional: Add UI for viewing download queue/status
