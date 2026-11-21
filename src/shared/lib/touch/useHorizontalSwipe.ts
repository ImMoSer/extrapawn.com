export interface HorizontalSwipeOptions {
  minDistancePx?: number
  horizontalRatio?: number
  onSwipeLeft: () => void
  onSwipeRight: () => void
}

export interface HorizontalSwipeHandlers {
  onTouchstart: (event: TouchEvent) => void
  onTouchend: (event: TouchEvent) => void
  onTouchcancel: () => void
}

/**
 * Lightweight horizontal swipe recognizer that ignores vertical scrolls.
 * Swipe left triggers `onSwipeLeft` (next); swipe right triggers `onSwipeRight` (prev).
 */
export function useHorizontalSwipe(options: HorizontalSwipeOptions): HorizontalSwipeHandlers {
  const minDistancePx = options.minDistancePx ?? 44
  const horizontalRatio = options.horizontalRatio ?? 1.4

  let startX: number | null = null
  let startY: number | null = null

  function reset(): void {
    startX = null
    startY = null
  }

  function onTouchstart(event: TouchEvent): void {
    if (event.touches.length !== 1) {
      reset()
      return
    }
    const touch = event.touches[0]
    if (!touch) return
    startX = touch.clientX
    startY = touch.clientY
  }

  function onTouchend(event: TouchEvent): void {
    if (startX === null || startY === null) return
    const touch = event.changedTouches[0]
    if (!touch) {
      reset()
      return
    }

    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    reset()

    if (Math.abs(dx) < minDistancePx) return
    if (Math.abs(dx) <= Math.abs(dy) * horizontalRatio) return

    if (dx < 0) {
      options.onSwipeLeft()
    } else {
      options.onSwipeRight()
    }
  }

  return {
    onTouchstart,
    onTouchend,
    onTouchcancel: reset,
  }
}
