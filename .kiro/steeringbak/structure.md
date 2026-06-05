# Project Structure

## Top-Level Layout
```
wxt.config.ts          # WXT config: manifest, permissions, vite plugins, dev profiles
package.json           # Dependencies and scripts
tailwind.config.js     # Tailwind theme (CSS variable-based colors, density tokens)
components.json        # shadcn/ui config (new-york style, aliases)
src/                   # All source code
public/                # Static assets: _locales/, icons/
```

## src/ Organization

### src/entrypoints/ — WXT auto-detected extension entry points
Each subfolder or file becomes a manifest entry. Platform-specific code is split into subfolders per platform.

- `background/` — Service worker: DB init, message routing, notifications
  - `handlers/` — Per-message-type handler functions
  - `message-handler.ts` — Central message dispatcher
- `content/` — Content scripts injected into host pages
  - `aistudio/`, `gemini/`, `chatgpt/` — Platform-specific init + tasks (scanning, syncing)
  - `shared/` — Cross-platform content script utilities
  - `index.ts` — Routes to platform via `detectPlatform()`
- `main-world/` — Scripts injected into page main world (unlisted)
  - `aistudio/`, `gemini/`, `chatgpt/` — Platform-specific HTTP interceptors
  - `lib/` — Shared interception utilities
  - `index.ts` — Routes to platform
- `overlay.content/` — The sidebar UI injected as a content script with Shadow DOM
  - `aistudio/`, `gemini/`, `chatgpt/` — Platform-specific layout wrappers
  - `shared/` — Cross-platform UI (the bulk of the overlay code)
    - `modules/` — Feature modules: explorer, search, prompts, favorites, tags, feedback, settings, whats-new
    - `components/` — Shared overlay components (FilterBar, OverlayToggle, menus)
    - `hooks/` — Overlay-specific hooks (useAppInit, useCurrentConversationId, useStoreFilter)
    - `types/` — Overlay types (filter, moduleConfig)
  - `index.tsx` — Routes to platform-specific layout
- `options/` — Options page (index.html + index.tsx)
- `offscreen.html` — Offscreen document for Chrome SQLite worker

### src/shared/ — Code shared across all entry points
- `db/` — Database layer
  - `schema.ts` — Table definitions and migrations
  - `index.ts` — DB access API (runQuery, runCommand, runBatch, export/import)
  - `operations/` — Repository modules per entity (folders, conversations, messages, favorites, tags, prompts, etc.)
- `lib/` — Utilities and stores
  - `store/` — Zustand app store (folders, conversations, UI state, actions)
  - `settings-store.ts` — Zustand settings store with chrome.storage.local persistence
  - `navigation.ts`, `modal.ts`, `toast.ts`, `prompt-variables.ts`, `tooltip-helper.ts`
  - `utils/` — General utilities (cn, htmlToMarkdown, etc.)
- `components/` — Shared React components (GlobalModal, GlobalToast, MarkdownRenderer, ShadowRootContext, ui/)
- `hooks/` — Shared hooks (useI18n, useUrl)
- `types/` — Shared TypeScript types (db.ts, messages.ts, platform.ts)
- `workers/` — Web Workers (db-worker.ts for SQLite WASM)

### src/styles/ — Platform-specific SCSS
- `_common.scss`, `_aistudio.scss`, `_gemini.scss`, `_chatgpt.scss`

### src/locale/ — i18n translation files
- `i18n.ts` — i18next setup
- `en.json`, `es.json`, `ja.json`, `pt.json`, `ru.json`, `zh-CN.json`, `zh-TW.json`

## Architecture Patterns
- Platform routing: `detectPlatform()` in content, main-world, and overlay entry points dispatches to platform-specific implementations
- Shared modules: Cross-platform logic lives in `shared/` or `overlay.content/shared/`; platform-specific code lives in `aistudio/`, `gemini/`, `chatgpt/` subfolders
- Message passing: Background service worker acts as central hub; content scripts and overlay communicate via `chrome.runtime.sendMessage` with typed message types
- DB access: All database operations go through the worker (offscreen doc on Chrome, direct worker on Firefox); never access DB directly from UI code
- Shadow DOM: Overlay UI is rendered inside a shadow root for style isolation from host pages
