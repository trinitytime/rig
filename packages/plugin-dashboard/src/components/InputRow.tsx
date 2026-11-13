/** @jsxImportSource hono/jsx */
import { Field, Row } from './Row.tsx'
import { controlProps, opt, str, type ItemProps } from './util.ts'

export const InputRow = ({ it, k }: ItemProps) => {
  const { id, ev, disabled, invalid } = controlProps(it, k)
  const type = ['number', 'password'].includes(str(it.inputType)) ? str(it.inputType) : 'text'
  return (
    <Row k={k} it={it} labelFor={id}>
      <Field id={id} it={it}>
        <input
          class="rig-input"
          type={type}
          id={id}
          data-ev={ev}
          value={opt(it.value)}
          placeholder={opt(it.placeholder)}
          min={opt(it.min)}
          max={opt(it.max)}
          pattern={opt(it.pattern)}
          required={it.required === true}
          disabled={disabled}
          {...invalid}
        />
      </Field>
    </Row>
  )
}
