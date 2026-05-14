import { forwardRef, type ButtonHTMLAttributes } from 'react'

import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'
export type ButtonSize = 'sm' | 'md'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  const variantClass =
    variant === 'secondary' ? styles.secondary : variant === 'danger' ? styles.danger : styles.primary
  const sizeClass = size === 'sm' ? styles.sm : styles.md

  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, variantClass, sizeClass, className)}
      {...rest}
    />
  )
})
