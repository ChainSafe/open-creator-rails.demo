export type ToastVariant = 'success' | 'error' | 'info'

export type ShowToastOptions = {
  variant?: ToastVariant
  /** Auto-dismiss delay in ms (default 4200). */
  durationMs?: number
}

export type ToastContextValue = {
  showToast: (message: string, options?: ShowToastOptions) => void
  dismissToast: (id: string) => void
}

