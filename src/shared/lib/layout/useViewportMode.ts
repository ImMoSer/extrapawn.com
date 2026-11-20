import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/**
 * Single Source of Truth for ExtraPawn layout shell breakpoints.
 * Desktop 3-column shell activates when viewport is landscape AND >= 900px wide
 * (enough room for 64px NavRail + 2x 240px side panels + square board + gaps).
 * Logical complement in CSS: `@media (max-width: 899px), (orientation: portrait)`.
 */
export const DESKTOP_SHELL_MEDIA_QUERY = '(min-width: 900px) and (orientation: landscape)'
export const COMPACT_MOBILE_MEDIA_QUERY = '(max-width: 639px)'

export interface ViewportModeState {
  isDesktopShell: Ref<boolean>
  isCompactMobile: Ref<boolean>
}

function readMediaMatch(query: string, fallback: boolean): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return fallback
  }
  return window.matchMedia(query).matches
}

export function useViewportMode(): ViewportModeState {
  const isDesktopShell = ref<boolean>(readMediaMatch(DESKTOP_SHELL_MEDIA_QUERY, true))
  const isCompactMobile = ref<boolean>(readMediaMatch(COMPACT_MOBILE_MEDIA_QUERY, false))

  let desktopMql: MediaQueryList | null = null
  let compactMql: MediaQueryList | null = null

  const updateDesktop = () => {
    if (desktopMql) isDesktopShell.value = desktopMql.matches
  }

  const updateCompact = () => {
    if (compactMql) isCompactMobile.value = compactMql.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    desktopMql = window.matchMedia(DESKTOP_SHELL_MEDIA_QUERY)
    compactMql = window.matchMedia(COMPACT_MOBILE_MEDIA_QUERY)
    updateDesktop()
    updateCompact()
    desktopMql.addEventListener('change', updateDesktop)
    compactMql.addEventListener('change', updateCompact)
  })

  onUnmounted(() => {
    desktopMql?.removeEventListener('change', updateDesktop)
    compactMql?.removeEventListener('change', updateCompact)
  })

  return {
    isDesktopShell,
    isCompactMobile,
  }
}
