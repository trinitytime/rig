/** @jsxImportSource hono/jsx */
import { Field, Row } from './Row.tsx'
import { controlProps, type ItemProps } from './util.ts'

export const ToggleRow = ({ it, k }: ItemProps) => {
  const { id, ev, disabled, invalid } = controlProps(it, k)
  return (
    <Row k={k} it={it} labelFor={id}>
      <Field id={id} it={it}>
        <input
          class="rig-toggle"
          type="checkbox"
          role="switch"
          id={id}
          data-ev={ev}
          checked={it.value === true}
          disabled={disabled}
          {...invalid}
        />
      </Field>
    </Row>
  )
}
