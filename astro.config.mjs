import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://medicinsksvenska.fi',
  output: 'static',
  build: { format: 'directory' },
  integrations: [sitemap()],
  vite: { build: { assetsInlineLimit: 0 } },
});
