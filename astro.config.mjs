import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  devToolbar: { enabled: false },
  site: 'https://lowendaff.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [mdx()],
  vite: { plugins: [tailwindcss()] },
});
