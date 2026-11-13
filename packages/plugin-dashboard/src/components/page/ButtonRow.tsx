/** @jsxImportSource hono/jsx */
import { Row } from './Row.tsx'
import { controlProps, str, type ItemProps } from '../util.ts'

export const ButtonRow = ({ it, k }: ItemProps) => {
  const { ev, disabled } = controlProps(it, k)
  const variant = ['primary', 'danger'].includes(str(it.variant)) ? ` rig-button--${str(it.variant)}` : ''
  return (
    <Row k={k} it={it}>
      <button class={`rig-button${variant}`} type="button" data-ev={ev} disabled={disabled}>
        {str(it.text ?? it.label)}
      </button>
    </Row>
  )
}
