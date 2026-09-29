import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const pageManifest = JSON.parse(
  readFileSync(resolve(projectRoot, 'platform-pages.json'), 'utf8'),
);

const pageInputs = Object.fromEntries(
  pageManifest.pages.map((page) => [
    `page-${page.id}`,
    resolve(projectRoot, page.entry),
  ]),
);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'qiyan-page-icons',
      transformIndexHtml() {
        return [
          { tag: 'link', attrs: { rel: 'icon', type: 'image/x-icon', href: '/logo/qiyan-icon.ico' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/logo/logo.png' }, injectTo: 'head' },
        ];
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        platform: resolve(projectRoot, 'index.html'),
        ...pageInputs,
      },
    },
  },
});
