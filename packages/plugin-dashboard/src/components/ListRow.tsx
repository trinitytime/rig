/** @jsxImportSource hono/jsx */
import { Badge } from './Badge.tsx'
import { Row } from './Row.tsx'
import { arr, obj, str, type ItemProps } from './util.ts'

export const ListRow = ({ it, k }: ItemProps) => (
  <Row k={k} it={it} block>
    <ul class="rig-list">
      {arr(it.items).map((r) => {
        const row = obj(r)
        return (
          <li>
            <span>{str(row.label)}</span>
            {row.badge ? <Badge b={obj(row.badge)} /> : null}
          </li>
        )
      })}
    </ul>
  </Row>
)
