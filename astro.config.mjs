// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://tidysnap.homes',
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true }
  }),
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: true,
      minify: 'esbuild',
    },
  },
  compressHTML: true,
});
