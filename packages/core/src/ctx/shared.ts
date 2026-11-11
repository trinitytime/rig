import { z } from "zod";
import type { PluginShared } from "../plugin/plugin.ts";

const name = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/, "must be 1-64 chars of letters, digits, '.', '-' or '_'");
const json = z.json();

type Workspace = { owner: string; data: Map<string, unknown> };

/** 메모리에만 있는 플러그인 간 공유 값. workspace는 처음 쓴 플러그인이 소유하고, 소유자만 쓸 수 있으며 누구나 읽을 수 있다. */
export class SharedMemory {
  private spaces = new Map<string, Workspace>();

  /** 쓰기 대상 workspace를 돌려준다. 없으면 만들고, 소유자가 다르면 던진다. 새로 만들면 created=true. */
  private writable(owner: string, ws: string): { space: Workspace; created: boolean } {
    const space = this.spaces.get(ws);
    if (!space) return { space: { owner, data: new Map() }, created: true };
    if (space.owner !== owner) throw new Error(`workspace "${ws}" is owned by another plugin`);
    return { space, created: false };
  }

  /** workspace를 만들었다면 그 해제 함수(소유자 정리용)를 track에 넘기고 등록한다. */
  set(owner: string, ws: string, key: string, value: unknown, track: (dispose: () => void) => unknown): void {
    const { space, created } = this.writable(owner, ws);
    if (created) {
      // 비활성화된 플러그인이면 track이 던지므로, 등록 전에 먼저 기록한다.
      track(() => {
        if (this.spaces.get(ws) === space) this.spaces.delete(ws);
      });
      this.spaces.set(ws, space);
    }
    space.data.set(key, structuredClone(value));
  }

  get(ws: string, key?: string): unknown {
    const space = this.spaces.get(ws);
    if (key === undefined) return structuredClone(Object.fromEntries(space?.data ?? []));
    return structuredClone(space?.data.get(key));
  }

  /** key가 있으면 그 값만, 없으면 workspace 전체를 지운다 (소유자만). */
  delete(owner: string, ws: string, key?: string): void {
    const space = this.spaces.get(ws);
    if (!space) return;
    if (space.owner !== owner) throw new Error(`workspace "${ws}" is owned by another plugin`);
    if (key === undefined) this.spaces.delete(ws);
    else space.data.delete(key);
  }
}

/** ctx.shared. 값은 JSON만 허용하고 복사본을 주고받으며, 모든 함수는 Promise를 반환한다. */
export function createShared(
  mem: SharedMemory,
  id: string,
  track: (dispose: () => void) => () => void,
): PluginShared {
  const shared: PluginShared = {
    async set(ws, key, value) {
      mem.set(id, name.parse(ws), name.parse(key), json.parse(value), track);
    },
    async get(ws: string, key?: string) {
      return mem.get(name.parse(ws), key === undefined ? undefined : name.parse(key)) as never;
    },
    async delete(ws, key) {
      mem.delete(id, name.parse(ws), key === undefined ? undefined : name.parse(key));
    },
  };
  return Object.freeze(shared);
}
