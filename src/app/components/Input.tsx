import { forwardRef, type InputHTMLAttributes } from 'react'

import styles from './Input.module.scss'

export type InputSize = 'sm' | 'md'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: InputSize
}

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ')
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', className, ...rest },
  ref,
) {
  const sizeClass = size === 'sm' ? styles.sm : styles.md

  return <input ref={ref} className={cx(styles.input, sizeClass, className)} {...rest} />
})
