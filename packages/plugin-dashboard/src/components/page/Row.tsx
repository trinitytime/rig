/** @jsxImportSource hono/jsx */
import type { Child } from 'hono/jsx'
import { str, type Obj } from './util.ts'

type RowProps = { k: string; it: Obj; block?: boolean; labelFor?: string; children: Child }

/** 설정 한 줄: 왼쪽에 라벨과 설명, 오른쪽에 컨트롤. */
export const Row = ({ k, it, block, labelFor, children }: RowProps) => (
  <div class={`rig-row${block ? ' rig-row--block' : ''}`} data-k={k}>
    <div class="rig-row-info">
      {labelFor ? (
        <label class="rig-row-label" for={labelFor}>
          {str(it.label)}
        </label>
      ) : (
        <span class="rig-row-label">{str(it.label)}</span>
      )}
      {it.description ? <p class="rig-row-desc">{str(it.description)}</p> : null}
    </div>
    <div class="rig-row-control">{children}</div>
  </div>
)

/** 입력 하나를 오류 문구와 함께 감싼다. error가 없으면 그대로 둔다. */
export const Field = ({ id, it, children }: { id: string; it: Obj; children: Child }) =>
  it.error ? (
    <div class="rig-field">
      {children}
      <p class="rig-error" id={`${id}-err`}>
        {str(it.error)}
      </p>
    </div>
  ) : (
    <>{children}</>
  )
