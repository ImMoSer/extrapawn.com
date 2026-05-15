import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import VueDevTools from 'vite-plugin-vue-devtools'
import pkg from './package.json'

export default defineConfig(({ mode }) => {
  return {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    plugins: [
      vue({
        template: {
          compilerOptions: {
            // <piece> - кастомный элемент
            isCustomElement: (tag) => tag.startsWith('piece'),
          },
        },
      }),

      // Custom Plugin to serve SQLite WASM assets from node_modules in DEV mode
      {
        name: 'sqlite-wasm-dev-server',
        apply: 'serve', // Only apply during development
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url?.split('?')[0]
            if (url === '/sqlite3-worker1.mjs' || url === '/sqlite3.wasm' || url === '/sqlite3-opfs-async-proxy.js') {
              const fileName = url.slice(1)
              const filePath = resolve(__dirname, `node_modules/@sqlite.org/sqlite-wasm/dist/${fileName}`)
              try {
                const content = readFileSync(filePath)
                const contentType = url.endsWith('.wasm') ? 'application/wasm' : 'application/javascript'
                res.setHeader('Content-Type', contentType)
                res.setHeader('Cache-Control', 'no-cache')
                res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
                res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
                return res.end(content)
              } catch (e) {
                console.error(`[sqlite-wasm-dev-server] Failed to serve ${fileName}:`, e)
              }
            }
            next()
          })
        }
      },

      AutoImport({
        imports: [
          'vue',
          {
            'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar'],
          },
        ],
      }),
      Components({
        dirs: ['src/components', 'src/shared/ui'],
        resolvers: [NaiveUiResolver()],
      }),

      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm',
            dest: '',
          },
          {
            src: 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3-opfs-async-proxy.js',
            dest: '',
          },
          {
            src: 'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3-worker1.mjs',
            dest: '',
          },
        ],
      }),

      ...(mode === 'development' ? [VueDevTools()] : []),
      visualizer({ open: false, filename: 'stats.html' }),

      // Auto-generate version.json for cache busting detection
      {
        name: 'generate-version-json',
        apply: 'build',
        closeBundle() {
          const versionPath = resolve(__dirname, 'dist/version.json');
          const data = { version: pkg.version, timestamp: Date.now() };
          writeFileSync(versionPath, JSON.stringify(data, null, 2));
        }
      }
    ],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      proxy: {
        '/api/coach-engine': {
          target: 'http://127.0.0.1:5004',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/coach-engine/, '')
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'naive-ui': ['naive-ui'],
            'echarts': ['echarts', 'vue-echarts'],
            'chess-logic': ['@lichess-org/chessground', 'chessops'],
            'vendor': ['vue', 'vue-router', 'pinia', 'vue-i18n'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  }
})
