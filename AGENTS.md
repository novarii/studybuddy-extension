# Repository Guidelines

## Project Structure & Module Organization
The extension is a single MV3 bundle rooted at the repository top level. `manifest.json` declares permissions and script entry points, `content.js` injects UI hooks into Viewer/Embed/List pages, and `background.js` hosts install flows plus notifications. Popup and options UIs are defined with paired HTML/JS files (`popup.*`, `options.*`) and share styling through `styles.css`. Icons live in `icons/` and must include 16/48/128 px PNGs before packaging; no separate build or src directories exist.

## Build, Test, and Development Commands
There is no bundler, so development means editing files directly and reloading the unpacked extension. Use `chrome://extensions` → enable Developer Mode → **Load unpacked** pointing at this folder. After code changes run `chrome://extensions` → **Reload** on the extension card, then refresh the Panopto tab. To prep a release archive run `zip -r panopto-downloader-extension.zip . -x "*.DS_Store"` and upload to the Chrome Web Store dashboard.

## Coding Style & Naming Conventions
JavaScript is plain ES2020 with `'use strict'` IIFEs, two-space indentation, and `const`/`let` over `var`. Prefer descriptive verbs such as `handleSingleDownload`, and keep DOM selectors centralized at the top of helper functions. User-facing strings should be routed through `showNotification` so background notifications remain consistent. No linter is configured, so run `npx eslint .` only if you add a config; otherwise match the existing formatting.

## Testing Guidelines
Automated tests are not present. Validate changes manually by loading a Viewer, Embed, and List page, triggering both single and batch downloads, and confirming the backend receives the payload logged by DevTools. Before commit, check that settings persist via `chrome.storage.sync`, notifications display correctly, and icon assets resolve (service worker console will warn if paths break).

## Commit & Pull Request Guidelines
Follow the repo’s short, imperative commit style (`Add files`, `Build test version`). Squash noisy work-in-progress commits before opening a PR. Every PR should describe the user-facing behavior change, list tested Panopto page types, and link any tracking issue. Attach screenshots or short screen captures for UI tweaks (popup/options/buttons) so reviewers can verify layout changes quickly.

## Security & Configuration Tips
Backend credentials are stored via `chrome.storage.sync`; never hardcode API keys, and avoid logging them outside local debugging sessions. Ensure your backend URL uses HTTPS and validates the `stream_url` value server-side. When adding new network calls, keep them scoped to `*.panopto.com` or backend domains already declared in `manifest.json` so reviewers can audit permissions easily.
