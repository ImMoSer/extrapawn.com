// vitest.config.ts
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfigFn from './vite.config.ts'

export default defineConfig((configEnv) => {
  const baseConfig = typeof viteConfigFn === 'function' 
    ? viteConfigFn(configEnv) 
    : viteConfigFn

  return mergeConfig(
    baseConfig,
    defineConfig({
      test: {
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'e2e/**'],
        root: fileURLToPath(new URL('./', import.meta.url)),
      },
    })
  )
})
