import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Build de PRÉVIA: gera um único arquivo .html com tudo dentro
 * (JS, CSS e fontes), para abrir/compartilhar sem servidor.
 *
 *   npm run build:preview   →  dist-preview/index.html
 *
 * Diferenças do build de produção:
 *   · sem service worker (não faz sentido num arquivo solto);
 *   · rotas por hash (#/quadro) para funcionar em qualquer hospedagem;
 *   · sempre em modo demonstração, com dados de exemplo no navegador.
 */
export default defineConfig({
  define: {
    __WE_DREAM_PREVIEW__: 'true',
  },
  resolve: {
    alias: {
      // não existe service worker num arquivo solto
      'virtual:pwa-register': fileURLToPath(new URL('./src/preview/pwa-register-stub.ts', import.meta.url)),
    },
  },
  plugins: [
    react(),
    {
      // /config.js só existe no container; na prévia ele não é servido
      name: 'wedream-sem-config-runtime',
      transformIndexHtml(html) {
        return html.replace(/\s*<script[^>]*src="[^"]*config\.js"[^>]*><\/script>/i, '')
      },
    },
    viteSingleFile({ removeViteModuleLoader: true }),
  ],
  build: {
    outDir: 'dist-preview',
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})
