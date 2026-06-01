import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import styles from './ToastContext.module.scss'
import { ToastContext } from './toastContext'
import type { ShowToastOptions, ToastVariant } from './toastTypes'

type ToastRecord = {
  id: string
  message: string
  variant: ToastVariant
  durationMs: number
}

const DEFAULT_DURATION_MS = 4200

function iconForVariant(variant: ToastVariant): string {
  switch (variant) {
    case 'success':
      return 'check_circle'
    case 'error':
      return 'error'
    default:
      return 'info'
  }
}

function ToastItem(props: {
  toast: ToastRecord
  onDismiss: (id: string) => void
}) {
  const { toast, onDismiss } = props

  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), toast.durationMs)
    return () => window.clearTimeout(t)
  }, [toast.id, toast.durationMs, onDismiss])

  const variantClass =
    toast.variant === 'success'
      ? styles.variantSuccess
      : toast.variant === 'error'
        ? styles.variantError
        : styles.variantInfo

  return (
    <div className={`${styles.toast} ${variantClass}`} role="status" aria-live="polite">
      <span className={`material-symbols-outlined ${styles.toastIcon}`}>{iconForVariant(toast.variant)}</span>
      <div className={styles.toastBody}>{toast.message}</div>
      <button
        type="button"
        className={styles.toastDismiss}
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
      >
        <span className={`material-symbols-outlined ${styles.toastDismissIcon}`}>close</span>
      </button>
    </div>
  )
}

function ToastViewport(props: { toasts: ToastRecord[]; onDismiss: (id: string) => void }) {
  const { toasts, onDismiss } = props
  if (toasts.length === 0) return null

  return (
    <div className={styles.viewport} aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const showToast = useCallback((message: string, options?: ShowToastOptions) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const variant = options?.variant ?? 'info'
    const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS
    setToasts((prev) => [...prev, { id, message, variant, durationMs }])
  }, [])

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    [showToast, dismissToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

