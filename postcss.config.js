import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import woff2Only from './scripts/postcss-woff2-only.mjs';

export default {
  // Array form (instead of the object map) so the local plugin can be imported.
  // woff2Only must run after tailwind so it also sees any @font-face emitted by
  // plugins, and it must run before Vite rewrites url() into data URIs.
  plugins: [tailwindcss, autoprefixer, woff2Only()],
}
