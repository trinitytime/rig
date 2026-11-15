/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx'
import { arr, controlProps, obj, str, type Obj } from '../util.ts'
import { Badge } from './Badge.tsx'
import { Button } from './Button.tsx'
import { Input } from './Input.tsx'
import { List } from './List.tsx'
import { Panel } from './Panel.tsx'
import { Row } from './Row.tsx'
import { Select } from './Select.tsx'
import { Table } from './Table.tsx'
import { Divider, Heading, Text } from './Text.tsx'
import { Textarea } from './Textarea.tsx'
import { Toggle } from './Toggle.tsx'

// 선언형 화면 JSON(shared "dashboard:page" 공간의 값)을 HTML로 그린다. 값은 모두 외부 입력이라 문자열로 바꿔 쓰고, hono가 이스케이프한다.
// shortcut: 스키마를 zod로 검증하지 않고 모르는 type은 건너뛴다, 플러그인이 늘어 오류 안내가 필요해지면 검증을 추가.

const CONTROLS: Record<string, FC<{ it: Obj; k: string }>> = {
  toggle: Toggle,
  input: Input,
  textarea: Textarea,
  select: Select,
  button: Button,
  list: List,
  table: Table,
}
/** 라벨이 가리킬 수 있는 입력 컨트롤. */
const LABELLED = new Set(['toggle', 'input', 'textarea', 'select'])
/** 라벨 아래에 한 줄을 다 쓰는 컨트롤. */
const BLOCK = new Set(['textarea', 'list', 'table'])

/** 라벨, 부연, 설명은 it에서 읽고, 오른쪽(블록이면 아래)에 컨트롤들을 놓는다. 컨트롤이 아닌 type은 건너뛴다. */
const RowItem = ({ it, k, kids }: { it: Obj; k: string; kids: [Obj, string][] }) => {
  const known = kids.flatMap(([c, ck]) => {
    const Control = CONTROLS[str(c.type)]
    return Control ? [{ Control, c, ck }] : []
  })
  const first = known.find(({ c }) => LABELLED.has(str(c.type)))
  return (
    <Row
      k={k}
      it={it}
      block={known.some(({ c }) => BLOCK.has(str(c.type)))}
      labelFor={first && controlProps(first.c, first.ck).id}
    >
      {known.map(({ Control, c, ck }) => (
        <Control it={c} k={ck} />
      ))}
    </Row>
  )
}

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
    default:
      return CONTROLS[str(it.type)] ? <RowItem it={it} k={k} kids={[[it, k]]} /> : null
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
