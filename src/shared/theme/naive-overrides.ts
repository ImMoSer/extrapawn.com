import type { GlobalThemeOverrides } from 'naive-ui'
import { tokens } from './tokens'

/**
 * Naive UI Theme Overrides bridging DESIGN.md tokens into Naive UI components
 */
export const naiveThemeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily: 'Ubuntu, sans-serif',
    primaryColor: tokens.neonCyan,
    primaryColorHover: tokens.cyanDeep,
    primaryColorPressed: tokens.cyanDeep,
    primaryColorSuppl: tokens.neonCyan,
    bodyColor: tokens.void,
    cardColor: tokens.surface,
    popoverColor: tokens.elevated,
    modalColor: tokens.elevated,
    borderColor: tokens.border,
    textColorBase: tokens.textPrimary,
    textColor1: tokens.textPrimary,
    textColor2: tokens.textSecondary,
    textColor3: tokens.textDisabled,
    successColor: tokens.success,
    warningColor: tokens.warning,
    errorColor: tokens.danger,
    infoColor: tokens.info,
    borderRadius: '8px',
    borderRadiusSmall: '4px',
  },
  Card: {
    color: tokens.surface,
    borderColor: tokens.border,
    borderRadius: '8px',
  },
  Select: {
    peers: {
      InternalSelection: {
        color: tokens.surface,
        colorActive: tokens.elevated,
        border: `1px solid ${tokens.border}`,
        borderHover: `1px solid ${tokens.neonCyan}`,
        borderActive: `1px solid ${tokens.neonCyan}`,
        borderFocus: `1px solid ${tokens.neonCyan}`,
        boxShadowFocus: `0 0 12px rgba(0, 229, 255, 0.5)`,
        borderRadius: '8px',
      },
      InternalSelectMenu: {
        color: tokens.elevated,
        borderRadius: '8px',
      },
    },
  },
  DataTable: {
    tdColor: 'transparent',
    tdColorHover: tokens.elevated,
    tdColorStriped: tokens.surface,
    thColor: tokens.elevated,
    borderColor: tokens.border,
  },
  Drawer: {
    color: tokens.surface,
    textColor: tokens.textPrimary,
  },
  Button: {
    borderRadiusMedium: '8px',
    borderRadiusSmall: '4px',
    borderRadiusLarge: '14px',
  },
}
