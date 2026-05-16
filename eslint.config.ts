import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import boundaries from 'eslint-plugin-boundaries'
import pluginVue from 'eslint-plugin-vue'
import { globalIgnores } from 'eslint/config'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['src/**/*.{ts,mts,tsx,vue}', 'eslint.config.ts', 'vite.config.ts', 'vitest.config.ts'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'public/**', '**/wasm-rs/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'vue/multi-word-component-names': 'off',
    }
  },

  {
    plugins: {
      boundaries
    },
    settings: {
      'boundaries/elements': [
        {
          type: 'app',
          pattern: 'src/app/*'
        },
        {
          type: 'pages',
          pattern: 'src/pages/*'
        },
        {
          type: 'widgets',
          pattern: 'src/widgets/*'
        },
        {
          type: 'features',
          pattern: 'src/features/*',
          capture: ['featureName']
        },
        {
          type: 'entities',
          pattern: 'src/entities/*',
          capture: ['entityName']
        },
        {
          type: 'shared',
          pattern: 'src/shared/*'
        }
      ],
      'boundaries/ignore': ['**/*.test.ts', '**/*.spec.ts', 'src/__tests__/**/*'],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.app.json'
        }
      }
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message: '${file.type} is not allowed to import ${dependency.type}',
          rules: [
            {
              from: 'shared',
              allow: ['shared']
            },
            {
              from: 'entities',
              allow: ['shared', ['entities', { entityName: '${from.entityName}' }]]
            },
            {
              from: 'features',
              allow: [
                'shared',
                'entities',
                ['features', { featureName: '${from.featureName}' }]
              ]
            },
            {
              from: 'widgets',
              allow: ['shared', 'entities', 'features', 'widgets']
            },
            {
              from: 'pages',
              allow: ['shared', 'entities', 'features', 'widgets', 'pages']
            },
            {
              from: 'app',
              allow: ['shared', 'entities', 'features', 'widgets', 'pages', 'app']
            }
          ]
        }
      ],
      'boundaries/no-private': 'error',
      'boundaries/entry-point': [
        'error',
        {
          rules: [
            {
              target: 'features',
              allow: ['index.ts', 'index.js'],
              disallow: ['**/*.vue']
            },
            {
              target: 'entities',
              allow: ['index.ts', 'index.js'],
              disallow: ['**/*.vue']
            },
            {
              target: 'shared',
              allow: '**/*'
            },
            {
              target: 'app',
              allow: '**/*'
            },
            {
              target: 'pages',
              allow: '**/*'
            },
            {
              target: 'widgets',
              allow: '**/*'
            }
          ]
        }
      ]
    }
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },
  skipFormatting,
)
