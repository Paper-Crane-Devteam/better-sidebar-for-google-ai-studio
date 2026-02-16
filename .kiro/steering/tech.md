# Tech Stack & Build

## Framework & Language
- WXT (v0.20+) — web extension framework with file-system routing for entry points
- React 18 + TypeScript (~5.8)
- Vite (bundled via WXT)

## UI
- Tailwind CSS 3 with CSS variables for theming (shadcn/ui "new-york" style)
- Radix UI primitives (dialog, dropdown, context menu, tooltip, scroll area, etc.)
- lucide-react icons
- class-variance-authority + clsx + tailwind-merge for class composition
- SCSS for platform-specific overlay styles
- Shadow DOM isolation for the overlay UI injected into host pages

## State Management
- Zustand 4 (app state + settings with chrome.storage.local persistence)

## Database
- SQLite WASM (@subframe7536/sqlite-wasm) via Web Worker
- OPFS storage (fallback: IndexedDB)
- Offscreen document (Chrome) or local worker (Firefox) for DB access
- FTS5 with trigram tokenizer for full-text search

## Key Libraries
- react-arborist — tree views (explorer, prompts)
- ajax-hook — HTTP request interception in main-world scripts
- dayjs — date formatting
- react-markdown + remark-gfm — markdown rendering
- i18next + react-i18next — internationalization
- jspdf — PDF export
- webextension-polyfill — cross-browser API compatibility
- @emailjs/browser — feedback form

## Common Commands
```bash
npm run dev            # Dev server (Chrome)
npm run dev:firefox    # Dev server (Firefox)
npm run build          # Production build (Chrome)
npm run build:firefox  # Production build (Firefox)
npm run zip            # Create Chrome store zip
npm run zip:firefox    # Create Firefox store zip
npm run compile        # TypeScript type-check (tsc --noEmit)
```

## Path Aliases
- `@/*` maps to `src/*`

## Browser Targets
- Chrome/Chromium (primary)
- Firefox (gecko ID: better-sidebar@zhangyu91101313.gmail.com, min v109)
- Edge (planned)
