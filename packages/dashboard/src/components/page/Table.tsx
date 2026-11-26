/** @jsxImportSource hono/jsx */
import { arr, str, type ItemProps } from '../util.ts'

export const Table = ({ it }: ItemProps) => (
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
)
