import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
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



      ...(mode === 'development' ? [VueDevTools()] : []),
      visualizer({ open: false, filename: 'stats.html' }),

      // Auto-generate version.json for cache busting detection
      {
        name: 'generate-version-json',
        apply: 'build',
        generateBundle() {
          const data = { version: pkg.version, timestamp: Date.now() };
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify(data, null, 2),
          })
        },
      },
    ],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
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
