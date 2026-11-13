/** @jsxImportSource hono/jsx */
import { Row } from './Row.tsx'
import { arr, str, type ItemProps } from '../util.ts'

export const TableRow = ({ it, k }: ItemProps) => (
  <Row k={k} it={it} block>
    <div class="rig-table-wrap">
      <table class="rig-table">
        <thead>
          <tr>
            {arr(it.columns).map((c) => (
              <th scope="col">{str(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {arr(it.rows).map((r) => (
            <tr>
              {arr(r).map((c) => (
                <td class={typeof c === 'number' ? 'rig-num' : undefined}>{str(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Row>
)
