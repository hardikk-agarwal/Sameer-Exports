import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://brass-builders.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  // Never inline scripts, so the Content-Security-Policy in public/_headers can allow scripts from this site only.
  vite: { build: { assetsInlineLimit: 0 } },
});
