/** @jsxImportSource hono/jsx */
import { Field } from './Row.tsx'
import { controlProps, str, type ItemProps } from '../util.ts'

export const Textarea = ({ it, k }: ItemProps) => {
  const { id, ev, disabled, invalid } = controlProps(it, k)
  return (
    <Field id={id} it={it}>
      <textarea
        class="rig-textarea"
        id={id}
        data-ev={ev}
        rows={Number(it.rows) || 3}
        required={it.required === true}
        disabled={disabled}
        {...invalid}
      >
        {str(it.value)}
      </textarea>
    </Field>
  )
}
