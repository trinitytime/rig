/** @jsxImportSource hono/jsx */
import { z } from 'zod'
import type { DashboardMenuItem } from '../../types.ts'
import { obj, str, type Obj } from '../util.ts'

export type PageEntry = { key: string; title: string }

/** shared "dashboard:page" 공간에서 화면 목록을 뽑는다. items 배열이 있는 값만 화면으로 본다. */
export function pageList(space: Obj): PageEntry[] {
  return Object.entries(space)
    .filter(([, v]) => Array.isArray(obj(v).items))
    .map(([key, v]) => ({ key, title: str(obj(v).title) || key }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

const menuItem = z.object({ name: z.string().min(1), page: z.string().min(1), order: z.number().optional() }) satisfies z.ZodType<DashboardMenuItem>
export type MenuEntry = z.infer<typeof menuItem>

/** shared "dashboard:menu" 공간에서 사이드바 메뉴를 뽑는다 ({ name, page, order? }). 화면(dashboard:page)과는 독립이라 없는 화면을 가리켜도 그대로 둔다. */
export function menuList(space: Obj): MenuEntry[] {
  return Object.values(space)
    .flatMap((v) => {
      const r = menuItem.safeParse(v)
      return r.success ? [r.data] : []
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

/** 왼쪽 메뉴. 각 항목은 화면 key(page)로 가고, current는 지금 보고 있는 화면의 key. */
export const Side = ({ base, menu, current }: { base: string; menu: MenuEntry[]; current?: string }) => (
  <aside class="rig-side">
    <h2 class="rig-side-title">Rig</h2>
    <nav aria-label="메뉴">
      <ul class="rig-nav-list">
        {menu.map((m) => (
          <li>
            <a
              class="rig-nav-item"
              href={`${base}${encodeURIComponent(m.page)}`}
              aria-current={m.page === current ? 'page' : undefined}
            >
              {m.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  </aside>
)
