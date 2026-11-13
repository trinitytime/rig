/** @jsxImportSource hono/jsx */
import { arr, obj, str, type Obj } from '../util.ts'
import { Badge } from './Badge.tsx'
import { ButtonRow } from './ButtonRow.tsx'
import { InputRow } from './InputRow.tsx'
import { ListRow } from './ListRow.tsx'
import { Panel } from './Panel.tsx'
import { SelectRow } from './SelectRow.tsx'
import { TableRow } from './TableRow.tsx'
import { Divider, Heading, Text } from './Text.tsx'
import { TextareaRow } from './TextareaRow.tsx'
import { ToggleRow } from './ToggleRow.tsx'

// 선언형 화면 JSON(shared "ui" 공간의 값)을 HTML로 그린다. 값은 모두 외부 입력이라 문자열로 바꿔 쓰고, hono가 이스케이프한다.
// shortcut: 스키마를 zod로 검증하지 않고 모르는 type은 건너뛴다, 플러그인이 늘어 오류 안내가 필요해지면 검증을 추가.

/** 항목 JSON의 type에 맞는 컴포넌트를 고른다. */
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

/** 화면 본문. 제목, 상태 배지, 설명 아래에 항목들을 그린다. pageKey가 없으면 안내 문구를 보인다. */
export const Page = ({ pageKey, page }: { pageKey?: string; page: Obj }) => {
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
  )
}
