/**
 * PostCSS plugin: keep only the woff2 source in every `@font-face` `src` list.
 *
 * Why this exists
 * ---------------
 * `src/index.scss` imports `katex/dist/katex.min.css`, which declares 20
 * @font-face rules, each listing three formats (woff2, woff, truetype). WXT
 * builds content scripts as a single self-contained file, so every `url()` in
 * the CSS is inlined as a base64 data URI — all 60 font files ended up inside
 * `content-scripts/overlay.js`, adding 1.37 MB:
 *
 *     font/ttf    20 files   669 KB
 *     font/woff   20 files   395 KB
 *     font/woff2  20 files   339 KB
 *
 * addons-linter refuses to validate any non-binary file over 5 MB, which blocked
 * the AMO upload. Dropping the woff/truetype fallbacks removes ~1.06 MB.
 *
 * Is it safe to drop them?
 * ------------------------
 * woff2 has been supported since Chrome 36 and Firefox 39 (2014/2015). The
 * manifest declares `strict_min_version: 109.0` for Gecko, and Chromium builds
 * target MV3, so every browser that can install this extension supports woff2.
 * The fallbacks were dead weight.
 *
 * The plugin is deliberately conservative: if a `src` list has no woff2 entry it
 * is left untouched, so non-KaTeX fonts that ship only woff/ttf keep working.
 */

/** Splits a comma-separated `src` value without breaking on commas inside url(). */
function splitSources(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

const isWoff2 = (source) =>
  /format\(\s*['"]?woff2['"]?\s*\)/i.test(source) || /\.woff2(\?|#|['")]|$)/i.test(source);

export default function woff2Only() {
  return {
    postcssPlugin: 'woff2-only',
    Declaration: {
      src(decl) {
        if (decl.parent?.type !== 'atrule') return;
        if (decl.parent.name.toLowerCase() !== 'font-face') return;

        const sources = splitSources(decl.value);
        if (sources.length < 2) return;

        const kept = sources.filter(isWoff2);
        // No woff2 available — leave the declaration alone rather than emptying it.
        if (kept.length === 0) return;

        decl.value = kept.map((s) => s.trim()).join(', ');
      },
    },
  };
}
