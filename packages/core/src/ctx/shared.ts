import { z } from 'zod'
import type { PluginShared } from '../plugin/plugin.ts'
import type { Track } from './ownership.ts'

const name = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/, "must be 1-64 chars of letters, digits, '.', '-' or '_'")
const json = z.json().optional()

type Entry = { owner: string; value: unknown; off?: () => void }

/**
 * 메모리에만 있는 플러그인 간 공유 값. workspace에는 소유자가 없고 key마다 소유자가 있다.
 * key를 처음 쓴 플러그인이 소유자이며, 소유자만 바꾸거나 지울 수 있고 읽기는 누구나 가능하다.
 * 지우면(delete, 또는 null/undefined를 쓰면) 소유권도 사라진다.
 * 값이 바뀌면 `shared:<workspace>` 신호를 { key, type: "set" | "delete", value? } 로 알린다 (소유자 id는 담지 않는다).
 */
export class SharedMemory {
  private spaces = new Map<string, Map<string, Entry>>()

  private emit: (signal: string, payload: unknown) => void

  constructor(emit: (signal: string, payload: unknown) => void) {
    this.emit = emit
  }

  private notify(ws: string, change: { key: string; type: 'set'; value: unknown } | { key: string; type: 'delete' }) {
    this.emit(`shared:${ws}`, change)
  }

  /** value가 null/undefined면 삭제로 처리한다. 새 key를 만들면 소유자 정리용 해제 함수를 track으로 기록한다. */
  set(owner: string, ws: string, key: string, value: unknown, track: Track): void {
    const cur = this.spaces.get(ws)?.get(key)
    if (cur && cur.owner !== owner) throw new Error(`"${ws}/${key}" is owned by another plugin`)
    if (value === null || value === undefined) return this.remove(ws, key)
    if (cur) {
      cur.value = structuredClone(value)
      return this.notify(ws, { key, type: 'set', value })
    }
    const entry: Entry = { owner, value: structuredClone(value) }
    // 비활성화된 플러그인이면 track이 던지므로, 저장 전에 먼저 기록한다.
    entry.off = track(() => {
      if (this.spaces.get(ws)?.get(key) === entry) this.remove(ws, key)
    })
    let space = this.spaces.get(ws)
    if (!space) this.spaces.set(ws, (space = new Map()))
    space.set(key, entry)
    this.notify(ws, { key, type: 'set', value })
  }

  get(ws: string, key?: string): unknown {
    const space = this.spaces.get(ws)
    if (key === undefined) return structuredClone(Object.fromEntries([...(space ?? [])].map(([k, e]) => [k, e.value])))
    return structuredClone(space?.get(key)?.value)
  }

  delete(owner: string, ws: string, key: string): void {
    const cur = this.spaces.get(ws)?.get(key)
    if (cur && cur.owner !== owner) throw new Error(`"${ws}/${key}" is owned by another plugin`)
    this.remove(ws, key)
  }

  private remove(ws: string, key: string): void {
    const space = this.spaces.get(ws)
    const entry = space?.get(key)
    if (!space || !entry) return
    space.delete(key)
    if (space.size === 0) this.spaces.delete(ws)
    entry.off?.() // 정리 목록에서도 뺀다
    this.notify(ws, { key, type: 'delete' })
  }
}

/** ctx.shared. 값은 JSON만 허용(null/undefined는 삭제)하고 복사본을 주고받으며, 모든 함수는 Promise를 반환한다. */
export function createShared(mem: SharedMemory, id: string, track: Track): PluginShared {
  const shared: PluginShared = {
    async set(ws, key, value) {
      mem.set(id, name.parse(ws), name.parse(key), json.parse(value), track)
    },
    async get(ws: string, key?: string) {
      return mem.get(name.parse(ws), key === undefined ? undefined : name.parse(key)) as never
    },
    async delete(ws, key) {
      mem.delete(id, name.parse(ws), name.parse(key))
    },
  }
  return Object.freeze(shared)
}
