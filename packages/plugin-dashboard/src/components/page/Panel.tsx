/** @jsxImportSource hono/jsx */
import type { Child } from 'hono/jsx'
import { str, type Obj } from '../util.ts'

/** 제목이 있는 접이식 묶음. 안의 항목은 children으로 받는다 (Item과 순환 import를 피하려고). */
export const Panel = ({ it, children }: { it: Obj; children: Child }) => (
  <details class="rig-section" open={it.open !== false}>
    <summary>{str(it.title)}</summary>
    {it.description ? <p class="rig-section-desc">{str(it.description)}</p> : null}
    {children}
  </details>
)
