import { cpSync, readFileSync } from 'node:fs';
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
let runtimeAssetsOutDir = resolve(projectRoot, 'dist');
function questionnaireRoute(server) {
  server.middlewares.use((req, _res, next) => {
    if (req.method === 'GET' && /^\/h5\/questionnaire\/[^/?]+(?:\?.*)?$/.test(req.url ?? '')) req.url = '/pages/h5-questionnaire/index.html';
    next();
  });
}

export default defineConfig({
  plugins: [
    react(),
    { name: 'qiyan-questionnaire-route', configureServer: questionnaireRoute, configurePreviewServer: questionnaireRoute },
    {
      name: 'qiyan-page-icons',
      transformIndexHtml() {
        return [
          { tag: 'link', attrs: { rel: 'icon', type: 'image/x-icon', href: '/logo/qiyan-icon.ico' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/logo/logo.png' }, injectTo: 'head' },
        ];
      },
    },
    {
      name: 'qiyan-p002-runtime-assets',
      configResolved(config) {
        runtimeAssetsOutDir = resolve(projectRoot, config.build.outDir);
      },
      closeBundle() {
        cpSync(
          resolve(projectRoot, 'pages/p002/assets'),
          resolve(runtimeAssetsOutDir, 'pages/p002/assets'),
          { recursive: true },
        );
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        platform: resolve(projectRoot, 'index.html'),
        knowledgeFrame: resolve(projectRoot, 'pages/k01/frame.html'),
        questionnaire: resolve(projectRoot, 'pages/h5-questionnaire/index.html'),
        ...pageInputs,
      },
    },
  },
});
