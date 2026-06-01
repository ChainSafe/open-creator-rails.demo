import { useContext } from 'react'
import type { ToastContextValue } from './toastTypes'
import { ToastContext } from './toastContext'

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

