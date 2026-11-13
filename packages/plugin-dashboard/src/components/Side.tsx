/** @jsxImportSource hono/jsx */
import type { PageEntry } from './util.ts'

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
