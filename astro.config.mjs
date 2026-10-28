import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://brass-builders.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
