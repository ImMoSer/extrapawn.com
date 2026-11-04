import { computed, ref } from 'vue'

export type ColorMode = 'dark' | 'light'

const COLOR_MODE_STORAGE_KEY = 'extrapawn_color_mode'

/**
 * Dark Mode Palette — Supabase Carbon × Lichess
 */
export const DARK_TOKENS = {
  // Neutral Surfaces & Typography
  canvas: '#121212',
  surface: '#1c1c1c',
  elevated: '#242424',
  overlay: '#2e2e2e',
  border: '#2e2e2e',
  borderHover: '#3e3e3e',
  textPrimary: '#ededed',
  textSecondary: '#a1a1aa',
  textDisabled: '#71717a',

  // Brand & Interactive Accents
  brand: '#3ecf8e',
  brandDeep: '#24b47e',
  onBrand: '#171717',
  accent: '#b49bff',
  accentDeep: '#8b5cf6',

  // Chess Semantics & Status
  success: '#3ecf8e',
  successDeep: '#24b47e',
  warning: '#f4bd50',
  warningDeep: '#d99b26',
  danger: '#f87171',
  dangerDeep: '#e11d48',
  info: '#38bdf8',
  infoDeep: '#0284c7',
  highlight: '#f472b6',
  highlightLight: '#f9a8d4',

  // Data-Viz & NAG Reserve (ECharts categorical set)
  orange: '#fb923c',
  orangeWarm: '#f97316',
  mint: '#2dd4bf',
  magenta: '#e879f9',
  amber: '#fbbf24',
  acidGreen: '#4ade80',
} as const

export type DesignTokens = {
  readonly [K in keyof typeof DARK_TOKENS]: string
}

/**
 * Light Mode Palette — Studio Daylight × Lichess
 */
export const LIGHT_TOKENS: DesignTokens = {
  // Neutral Surfaces & Typography
  canvas: '#f4f4f5',
  surface: '#ffffff',
  elevated: '#ececee',
  overlay: '#ffffff',
  border: '#e4e4e7',
  borderHover: '#d4d4d8',
  textPrimary: '#171717',
  textSecondary: '#52525b',
  textDisabled: '#71717a',

  // Brand & Interactive Accents
  brand: '#047857',
  brandDeep: '#065f46',
  onBrand: '#ffffff',
  accent: '#6d28d9',
  accentDeep: '#5b21b6',

  // Chess Semantics & Status
  success: '#15803d',
  successDeep: '#166534',
  warning: '#b45309',
  warningDeep: '#92400e',
  danger: '#b91c1c',
  dangerDeep: '#991b1b',
  info: '#0369a1',
  infoDeep: '#075985',
  highlight: '#db2777',
  highlightLight: '#ec4899',

  // Data-Viz & NAG Reserve (ECharts categorical set)
  orange: '#ea580c',
  orangeWarm: '#c2410c',
  mint: '#0d9488',
  magenta: '#c026d3',
  amber: '#d97706',
  acidGreen: '#16a34a',
} as const

function applyDomColorMode(mode: ColorMode): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
  }
}

function loadInitialColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    const saved = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      applyDomColorMode(saved)
      return saved
    }
  } catch {
    // Ignore storage access errors
  }
  applyDomColorMode('dark')
  return 'dark'
}

export const colorMode = ref<ColorMode>(loadInitialColorMode())
export const isDarkMode = computed<boolean>(() => colorMode.value === 'dark')

export function setColorMode(mode: ColorMode): void {
  colorMode.value = mode
  applyDomColorMode(mode)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
    } catch {
      // Ignore storage access errors
    }
  }
}

export function toggleColorMode(): void {
  setColorMode(colorMode.value === 'dark' ? 'light' : 'dark')
}

export function getTokensByMode(mode: ColorMode): DesignTokens {
  return mode === 'light' ? LIGHT_TOKENS : DARK_TOKENS
}

/**
 * Reactive proxy over the active theme tokens.
 * Any Vue computed() or render function reading `tokens.xyz` automatically tracks `colorMode`
 * and updates when the user toggles between Dark and Light themes.
 */
export const tokens: DesignTokens = new Proxy(DARK_TOKENS as DesignTokens, {
  get(_target, prop: string | symbol): string {
    const active = colorMode.value === 'light' ? LIGHT_TOKENS : DARK_TOKENS
    return active[prop as keyof DesignTokens]
  },
})

export function useThemeTokens() {
  return {
    colorMode,
    isDarkMode,
    tokens,
    setColorMode,
    toggleColorMode,
  }
}
