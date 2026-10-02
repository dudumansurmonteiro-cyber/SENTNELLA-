import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// site: [domínio] em definição — trocar quando o domínio próprio for decidido (ver PENDENCIAS.md)
export default defineConfig({
  site: 'https://sentinella.pages.dev',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
