/** @jsxImportSource hono/jsx */
import { obj, str, type Obj } from '../util.ts'

export type PageEntry = { key: string; title: string }

/** shared "ui" 공간에서 화면 목록을 뽑는다. items 배열이 있는 값만 화면으로 본다. */
export function pageList(space: Obj): PageEntry[] {
  return Object.entries(space)
    .filter(([, v]) => Array.isArray(obj(v).items))
    .map(([key, v]) => ({ key, title: str(obj(v).title) || key }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** 왼쪽 화면 목록. current는 지금 보고 있는 화면의 key. */
export const Side = ({ base, pages, current }: { base: string; pages: PageEntry[]; current?: string }) => (
  <aside class="rig-side">
    <h2 class="rig-side-title">Rig</h2>
    <nav aria-label="화면 목록">
      <ul class="rig-nav-list">
        {pages.map((p) => (
          <li>
            <a
              class="rig-nav-item"
              href={`${base}?p=${encodeURIComponent(p.key)}`}
              aria-current={p.key === current ? 'page' : undefined}
            >
              {p.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  </aside>
)
