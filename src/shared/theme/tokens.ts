/**
 * Single source of truth for design tokens used by Naive UI, ECharts, and JS/TS components.
 * Matches hex values defined in main.css (@theme block) and DESIGN.md.
 */
export const tokens = {
  // Neutrals (Zen Dark Surface)
  void: '#05060a',
  surface: '#0d0f16',
  elevated: '#151822',
  border: '#232838',
  borderHover: '#333a4f',
  textPrimary: '#e8ecf5',
  textSecondary: '#8b93a8',
  textDisabled: '#4a5169',

  // Primary
  neonCyan: '#00e5ff',
  cyanDeep: '#00b8cc',
  neonPurple: '#b000ff',
  purpleDeep: '#7a00cc',

  // Semantic
  success: '#00ff55',
  successDeep: '#00cc44',
  warning: '#ffe600',
  warningDeep: '#ccb800',
  danger: '#ff073a',
  dangerDeep: '#d9004c',
  info: '#0055ff',
  infoDeep: '#3d8bff',
  highlight: '#ff007a',
  highlightLight: '#ff4da6',

  // Data-Viz Reserve (ECharts categorical set)
  orange: '#ff5500',
  orangeWarm: '#ff8800',
  mint: '#00ffcc',
  magenta: '#ff00c8',
  amber: '#ff9900',
  acidGreen: '#39ff14',
} as const

export type DesignTokens = typeof tokens
