# Build Instructions for Firefox Reviewer

This extension is built using WXT (https://wxt.dev/), React, and Tailwind CSS.

## Prerequisites

- Node.js (Version 18 or higher recommended)
- npm

## Installation

1. Unzip the source code.
2. Open a terminal in the root directory of the project.
3. Install dependencies:

```bash
npm install
```

## Build Steps

To build the extension for Firefox (Manifest V2/V3 compatible build as configured in wxt.config.ts):

```bash
npm run build:firefox
```

## Output

The built extension will be located in the `.output/firefox-mv2` (or `.output/firefox-mv3` depending on WXT default) directory.
You can load this directory as a temporary add-on in Firefox for testing.

## Notes

- The project uses `wa-sqlite` which relies on WASM.
- The configuration is handled in `wxt.config.ts`.
