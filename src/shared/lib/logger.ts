// src/utils/logger.ts
declare global {
  interface Window {
    APP_FORCE_LOGGING: boolean | null
  }
}

const IS_DEV_MODE = import.meta.env.MODE === 'development'

if (typeof window.APP_FORCE_LOGGING === 'undefined') {
  window.APP_FORCE_LOGGING = null
}

function shouldLog(level: 'error' | 'warn' | 'info' | 'debug' | 'log' = 'log'): boolean {
  if (typeof window.APP_FORCE_LOGGING === 'boolean') {
    return window.APP_FORCE_LOGGING ? true : level === 'error'
  }
  if (IS_DEV_MODE) {
    return true
  } else {
    return level === 'error'
  }
}

const logger = {
  log: (...args: unknown[]) => {
    if (shouldLog('log')) {
      console.log('[LOG]', ...args)
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info('%c[INFO]', 'color: blue; font-weight: bold;', ...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('%c[WARN]', 'color: orange; font-weight: bold;', ...args)
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error('%c[ERROR]', 'color: red; font-weight: bold;', ...args)
    }
  },
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug('%c[DEBUG]', 'color: green; font-weight: bold;', ...args)
    }
  },
  setForceLogging: (value: boolean | null) => {
    if (typeof value === 'boolean' || value === null) {
      window.APP_FORCE_LOGGING = value
      console.info(
        `%c[LOGGER_CONFIG] APP_FORCE_LOGGING установлен в: ${value}`,
        'color: purple; font-style: italic;',
      )
    } else {
      console.warn(
        '%c[LOGGER_CONFIG] Неверное значение для setForceLogging. Ожидается boolean oder null.',
        'color: purple; font-style: italic;',
      )
    }
  },
  isLoggingEnabledForLevel: (level: 'error' | 'warn' | 'info' | 'debug' | 'log'): boolean =>
    shouldLog(level),
  isDevMode: (): boolean => IS_DEV_MODE,
  getForceLoggingStatus: (): boolean | null => window.APP_FORCE_LOGGING,
}

if (IS_DEV_MODE && window.APP_FORCE_LOGGING !== false) {
  console.log(
    `%c[LOGGER_INIT] Логгер инициализирован. Режим разработки: ${IS_DEV_MODE}. Принудительное логирование: ${window.APP_FORCE_LOGGING === null ? 'не установлено (по умолчанию)' : window.APP_FORCE_LOGGING}. Ошибки всегда логируются (если APP_FORCE_LOGGING не false).`,
    'color: purple; font-style: italic;',
  )
}

export default logger
