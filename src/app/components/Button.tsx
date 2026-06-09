import { forwardRef, type ButtonHTMLAttributes } from 'react'

import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'
export type ButtonSize = 'sm' | 'md'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and sets aria-busy; also disables the button. */
  loading?: boolean
}

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', loading = false, disabled, children, ...rest },
  ref,
) {
  const variantClass =
    variant === 'secondary' ? styles.secondary : variant === 'danger' ? styles.danger : styles.primary
  const sizeClass = size === 'sm' ? styles.sm : styles.md

  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, variantClass, sizeClass, loading && styles.loading, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : null}
      {children}
    </button>
  )
})
