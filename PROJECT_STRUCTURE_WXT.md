# Project Structure (WXT Migration)

This project has been migrated to use [WXT](https://wxt.dev/), a modern framework for web extensions.

## Directory Layout

```
.
├── wxt.config.ts        # WXT configuration (replaces vite.config.ts/manifest.config.ts)
├── tsconfig.json        # TypeScript config extending .wxt/tsconfig.json
├── package.json         # Dependencies (wxt, @wxt-dev/module-react)
├── src/
│   ├── entrypoints/     # Extension entry points (auto-detected by WXT)
│   │   ├── background.ts       # Background service worker
│   │   ├── content/            # Content scripts
│   │   │   └── index.ts        # Main content script
│   │   ├── sidepanel/          # Side panel UI
│   │   │   ├── index.html
│   │   │   └── index.tsx
│   │   ├── options/            # Options page UI
│   │   │   ├── index.html
│   │   │   └── index.tsx
│   │   ├── offscreen.html      # Offscreen document for SQLite
│   │   ├── offscreen.ts        # Offscreen logic
│   │   └── main-world.ts       # Script injected into main world (unlisted)
│   ├── shared/          # Shared code (components, db, types, lib)
│   │   ├── workers/     # Web Workers (e.g. db-worker.ts)
│   │   └── ...
│   ├── public/          # Static assets (sqlite3.wasm, icons)
│   └── index.css        # Global styles (Tailwind)
```

## Key Changes from CRXJS

1.  **Entry Points**: All extension entry points must live in `src/entrypoints`. WXT uses file-system routing to generate the manifest.
    - `background.ts` -> Background Script
    - `content/index.ts` -> Content Script
    - `sidepanel/index.html` -> Side Panel
    - `options/index.html` -> Options Page

2.  **Configuration**: `wxt.config.ts` handles the manifest generation and build configuration. Permissions and host permissions are defined here.

3.  **Imports**: Used `@/` alias for all imports from `src/`.

4.  **Assets**: `main-world.js` and `db-worker.ts` are handled specifically. `main-world.ts` is an "unlisted script" entrypoint, meaning it's built but not added to the manifest automatically.

## Development

- `npm run dev`: Start dev server (Chrome)
- `npm run dev:firefox`: Start dev server (Firefox)
- `npm run build`: Build for production
- `npm run zip`: Create zip for store

