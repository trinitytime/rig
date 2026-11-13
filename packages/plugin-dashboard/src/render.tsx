/** @jsxImportSource hono/jsx */
import { Badge } from './components/Badge.tsx'
import { ButtonRow } from './components/ButtonRow.tsx'
import { InputRow } from './components/InputRow.tsx'
import { ListRow } from './components/ListRow.tsx'
import { Panel } from './components/Panel.tsx'
import { SelectRow } from './components/SelectRow.tsx'
import { TableRow } from './components/TableRow.tsx'
import { Divider, Heading, Text } from './components/Text.tsx'
import { TextareaRow } from './components/TextareaRow.tsx'
import { ToggleRow } from './components/ToggleRow.tsx'
import { arr, obj, str, type Obj } from './components/util.ts'

// 선언형 화면 JSON(shared "ui" 공간의 값)을 HTML로 그린다. 값은 모두 외부 입력이라 문자열로 바꿔 쓰고, hono가 이스케이프한다.
// shortcut: 스키마를 zod로 검증하지 않고 모르는 type은 건너뛴다, 플러그인이 늘어 오류 안내가 필요해지면 검증을 추가.

const Item = ({ it: raw, k }: { it: unknown; k: string }) => {
  const it = obj(raw)
  switch (it.type) {
    case 'heading':
      return <Heading it={it} k={k} />
    case 'text':
      return <Text it={it} k={k} />
    case 'divider':
      return <Divider k={k} />
    case 'badge':
      return (
        <span data-k={k}>
          <Badge b={it} />
        </span>
      )
    case 'section':
      return (
        <Panel it={it}>
          {arr(it.items).map((c, i) => (
            <Item it={c} k={`${k}.${i}`} />
          ))}
        </Panel>
      )
    case 'toggle':
      return <ToggleRow it={it} k={k} />
    case 'input':
      return <InputRow it={it} k={k} />
    case 'textarea':
      return <TextareaRow it={it} k={k} />
    case 'select':
      return <SelectRow it={it} k={k} />
    case 'button':
      return <ButtonRow it={it} k={k} />
    case 'list':
      return <ListRow it={it} k={k} />
    case 'table':
      return <TableRow it={it} k={k} />
    default:
      return null
  }
}

export type PageEntry = { key: string; title: string }

/** shared "ui" 공간에서 화면 목록을 뽑는다. items 배열이 있는 값만 화면으로 본다. */
export function pageList(space: Obj): PageEntry[] {
  return Object.entries(space)
    .filter(([, v]) => Array.isArray(obj(v).items))
    .map(([key, v]) => ({ key, title: str(obj(v).title) || key }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export const Shell = ({ base, space, current }: { base: string; space: Obj; current?: string }) => {
  const pages = pageList(space)
  const key = pages.find((p) => p.key === current)?.key ?? pages[0]?.key
  const page = key ? obj(space[key]) : {}
  const status = obj(page.status)
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{key ? `${str(page.title) || key} — Rig` : 'Rig'}</title>
        <link rel="stylesheet" href={`${base}rig-ui.css`} />
      </head>
      <body class="rig-shell" data-page={key} data-base={base}>
        <aside class="rig-side">
          <h2 class="rig-side-title">Rig</h2>
          <nav aria-label="화면 목록">
            <ul class="rig-nav-list">
              {pages.map((p) => (
                <li>
                  <a
                    class="rig-nav-item"
                    href={`${base}?p=${encodeURIComponent(p.key)}`}
                    aria-current={p.key === key ? 'page' : undefined}
                  >
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main class="rig-page">
          {key ? (
            <>
              <header data-k="h" style="display:grid;gap:4px">
                <div class="rig-actions" style="justify-content:space-between;align-items:center">
                  <h1 class="rig-heading">{str(page.title) || key}</h1>
                  {status.text ? <Badge b={status} /> : null}
                </div>
                {page.description ? <p class="rig-text rig-text--muted">{str(page.description)}</p> : null}
              </header>
              {arr(page.items).map((it, i) => (
                <Item it={it} k={String(i)} />
              ))}
            </>
          ) : (
            <p class="rig-text rig-text--muted" data-k="empty">
              표시할 화면이 없습니다.
            </p>
          )}
        </main>
        <script src={`${base}client.js`} defer></script>
      </body>
    </html>
  )
}
