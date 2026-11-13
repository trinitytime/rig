/** @jsxImportSource hono/jsx */
import type { Child } from 'hono/jsx'
import { Badge } from './Badge.tsx'
import { obj, str, type Obj } from './util.ts'

/** 화면 본문. 제목, 상태 배지, 설명 아래에 항목(children)을 놓는다. page가 없으면 안내 문구를 보인다. */
export const Page = ({ pageKey, page, children }: { pageKey?: string; page: Obj; children: Child }) => {
  const status = obj(page.status)
  return (
    <main class="rig-page">
      {pageKey ? (
        <>
          <header data-k="h" style="display:grid;gap:4px">
            <div class="rig-actions" style="justify-content:space-between;align-items:center">
              <h1 class="rig-heading">{str(page.title) || pageKey}</h1>
              {status.text ? <Badge b={status} /> : null}
            </div>
            {page.description ? <p class="rig-text rig-text--muted">{str(page.description)}</p> : null}
          </header>
          {children}
        </>
      ) : (
        <p class="rig-text rig-text--muted" data-k="empty">
          표시할 화면이 없습니다.
        </p>
      )}
    </main>
  )
}
