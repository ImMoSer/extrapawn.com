import logger from '@/shared/lib/logger';
import type { App, ComponentPublicInstance } from 'vue';

export function setupErrorHandler(app: App) {
  // 1. Vue Global Error Handler
  app.config.errorHandler = (err: unknown, instance: ComponentPublicInstance | null, info: string) => {
    const error = err instanceof Error ? err : new Error(String(err));

    logger.error('[Vue Error]:', error, {
        info,
        component: instance?.$options?.name || instance?.$options?.__name || 'UnknownComponent'
    });
  };

  // 2. Global Script Errors (window.onerror)
  window.onerror = (message, source, lineno, colno, error) => {
    let msgString = String(message)
    let details: { filename?: string; lineno?: number; colno?: number } = {}

    if (message instanceof ErrorEvent) {
      msgString = `[ErrorEvent] ${message.message || 'unknown message'}`
      details = {
        filename: message.filename,
        lineno: message.lineno,
        colno: message.colno,
      }
    } else if (typeof message !== 'string') {
      msgString = (message as unknown as { message?: string })?.message || String(message)
    }

    if (msgString.includes('ResizeObserver')) {
      return false; // Ignore harmless ResizeObserver errors
    }

    logger.error('[Window Error]:', {
        message: msgString,
        source: source || details.filename,
        lineno: lineno || details.lineno,
        colno: colno || details.colno,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...details
    });
    return false; // Позволяем ошибке всплыть в консоль
  };

  // 3. Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('[Unhandled Rejection]:', event.reason);
  });
}
