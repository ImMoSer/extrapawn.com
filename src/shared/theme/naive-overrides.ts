import type { GlobalThemeOverrides } from 'naive-ui'
import { computed } from 'vue'
import { colorMode, getTokensByMode, type ColorMode } from './tokens'

/**
 * Generates Naive UI GlobalThemeOverrides for the specified ColorMode (Dark or Light).
 */
export function getNaiveThemeOverrides(mode: ColorMode): GlobalThemeOverrides {
  const t = getTokensByMode(mode)

  return {
    common: {
      fontFamily: 'Ubuntu, sans-serif',
      primaryColor: t.brand,
      primaryColorHover: t.brandDeep,
      primaryColorPressed: t.brandDeep,
      primaryColorSuppl: t.brand,
      bodyColor: t.canvas,
      cardColor: t.surface,
      popoverColor: t.overlay,
      modalColor: t.surface,
      tableColor: t.surface,
      inputColor: t.elevated,
      borderColor: t.border,
      dividerColor: t.border,
      textColorBase: t.textPrimary,
      textColor1: t.textPrimary,
      textColor2: t.textSecondary,
      textColor3: t.textSecondary,
      textColorDisabled: t.textDisabled,
      successColor: t.success,
      warningColor: t.warning,
      errorColor: t.danger,
      infoColor: t.info,
      borderRadius: '6px',
      borderRadiusSmall: '4px',
    },
    Card: {
      color: t.surface,
      colorModal: t.surface,
      borderColor: t.border,
      borderRadius: '8px',
    },
    Layout: {
      color: t.canvas,
      siderColor: t.surface,
      siderBorderColor: t.border,
      headerColor: t.surface,
      headerBorderColor: t.border,
    },
    Menu: {
      itemTextColor: t.textSecondary,
      itemTextColorHover: t.textPrimary,
      itemTextColorActive: t.textPrimary,
      itemTextColorActiveHover: t.textPrimary,
      itemIconColor: t.textSecondary,
      itemIconColorHover: t.textPrimary,
      itemIconColorActive: t.brand,
      itemIconColorActiveHover: t.brand,
      itemIconColorCollapsed: t.textSecondary,
      itemColorHover: t.elevated,
      itemColorActive: t.elevated,
      itemColorActiveHover: t.elevated,
      borderRadius: '6px',
    },
    Select: {
      peers: {
        InternalSelection: {
          color: t.elevated,
          colorActive: t.elevated,
          textColor: t.textPrimary,
          border: `1px solid ${t.border}`,
          borderHover: `1px solid ${t.borderHover}`,
          borderActive: `1px solid ${t.brand}`,
          borderFocus: `1px solid ${t.brand}`,
          boxShadowFocus: `0 0 0 2px ${t.brand}26`,
          borderRadius: '6px',
        },
        InternalSelectMenu: {
          color: t.overlay,
          borderRadius: '8px',
        },
      },
    },
    DataTable: {
      tdColor: 'transparent',
      tdColorHover: t.elevated,
      tdColorStriped: t.surface,
      thColor: t.elevated,
      thTextColor: t.textSecondary,
      tdTextColor: t.textPrimary,
      borderColor: t.border,
      borderRadius: '8px',
    },
    Drawer: {
      color: t.surface,
      textColor: t.textPrimary,
      headerBorderBottom: `1px solid ${t.border}`,
    },
    Modal: {
      color: t.surface,
      textColor: t.textPrimary,
    },
    Button: {
      borderRadiusSmall: '4px',
      borderRadiusMedium: '6px',
      borderRadiusLarge: '8px',
      textColorPrimary: t.onBrand,
      textColorHoverPrimary: t.onBrand,
      textColorPressedPrimary: t.onBrand,
      textColorFocusPrimary: t.onBrand,
      fontWeight: '500',
    },
  }
}

/**
 * Reactive Naive UI Theme Overrides computed from the active colorMode.
 */
export const naiveThemeOverrides = computed<GlobalThemeOverrides>(() =>
  getNaiveThemeOverrides(colorMode.value),
)
