/** @jsxImportSource hono/jsx */
import { Field } from './Row.tsx'
import { arr, controlProps, obj, str, type ItemProps } from '../util.ts'

export const Select = ({ it, k }: ItemProps) => {
  const { id, ev, disabled, invalid } = controlProps(it, k)
  return (
    <Field id={id} it={it}>
      <select class="rig-select" id={id} data-ev={ev} disabled={disabled} {...invalid}>
        {arr(it.options).map((o) => {
          const { value, label } = typeof o === 'object' ? obj(o) : { value: o, label: o }
          return (
            <option value={str(value)} selected={str(value) === str(it.value)}>
              {str(label ?? value)}
            </option>
          )
        })}
      </select>
    </Field>
  )
}
