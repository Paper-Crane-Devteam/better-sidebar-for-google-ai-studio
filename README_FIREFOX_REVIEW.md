# Build Instructions for Firefox Reviewer

This extension is built with [WXT](https://wxt.dev/), React and Tailwind CSS.

## Reference build environment

The uploaded XPI was produced with:

- **Node.js 22.17.0**
- **npm 10.9.2**
- macOS (arm64)

Please use Node 22.x. Other major versions may resolve different optional
platform binaries for `esbuild` / `rollup` / `sass` and are not guaranteed to
produce a byte-identical bundle.

## Installation

1. Unzip the source package.
2. Open a terminal in the root directory of the project (the folder containing
   `package.json`).
3. Install dependencies **from the lockfile**:

```bash
npm ci
```

Use `npm ci`, not `npm install`. `npm install` is allowed to update
`package-lock.json` and may resolve newer versions of transitive dependencies,
which changes the generated bundle.

The `postinstall` script runs `patch-package && wxt prepare`. The `patches/`
directory is part of this source package and must not be removed — it applies a
required patch to `react-arborist`.

## Build

```bash
npm run build:firefox
```

## Output

The build output is written to:

```
.output/firefox-mv2/
```

This directory can be loaded directly in Firefox as a temporary add-on
(`about:debugging` → This Firefox → Load Temporary Add-on → pick
`.output/firefox-mv2/manifest.json`).

To produce the packaged archive instead:

```bash
npm run zip:firefox
```

which writes `.output/better-sidebar-for-google-ai-studio-<version>-firefox.zip`.

## Notes

- **`.env` is included in this source package and is required.** The values in
  it are inlined at build time through `import.meta.env.VITE_*` (Google OAuth
  client id/secret, license validation endpoint, EmailJS ids). If `.env` is
  missing, Vite replaces those expressions with `undefined` and the resulting
  `background.js` and `content-scripts/overlay.js` will not match the uploaded
  XPI. These constants are already present in plain text in the published
  bundle; an extension cannot keep them secret.
- The project bundles `wa-sqlite` (SQLite compiled to WASM). The `.wasm` and
  `.mjs` assets live in `src/assets/wa-sqlite-fts5/` and are copied into
  `assets/` by `vite-plugin-static-copy`. This is why the manifest declares
  `'wasm-unsafe-eval'` in its CSP.
- Build configuration lives in `wxt.config.ts`.
- No minification-only obfuscation is applied. The production build only drops
  `console.log` / `console.debug` / `console.info` calls and `debugger`
  statements (see the `esbuild` section of `wxt.config.ts`).
