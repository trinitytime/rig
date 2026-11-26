/** @jsxImportSource hono/jsx */
import { controlProps, str, type ItemProps } from '../util.ts'

export const Button = ({ it, k }: ItemProps) => {
  const { ev, disabled } = controlProps(it, k)
  const variant = ['primary', 'danger'].includes(str(it.variant)) ? ` rig-button--${str(it.variant)}` : ''
  return (
    <button class={`rig-button${variant}`} type="button" data-ev={ev} disabled={disabled}>
      {str(it.text ?? it.label)}
    </button>
  )
}
