/** 등록한 것의 해제 함수를 기록하고, 개별 해제용 함수를 돌려준다. (ctx 안에서 플러그인 id에 묶여 만들어진다) */
export type Track = (dispose: () => void) => () => void

/** 플러그인 id별로, ctx를 통해 등록된 것들의 해제 함수를 모아 둔다. */
export class Ownership {
  private owned = new Map<string, Set<() => void>>()

  /** 플러그인 활성화 직전에 호출. */
  open(id: string): void {
    this.owned.set(id, new Set())
  }

  /** 등록된 것의 해제 함수를 기록하고, 개별 해제용 함수를 돌려준다. 열려 있지 않은 id면 바로 해제하고 던진다. */
  track(id: string, dispose: () => void): () => void {
    const set = this.owned.get(id)
    if (!set) {
      dispose()
      throw new Error('plugin is not active')
    }
    set.add(dispose)
    return () => {
      if (set.delete(dispose)) dispose()
    }
  }

  /** 이 id의 등록을 모두 역순으로 해제하고 닫는다. 이후의 track은 거부된다. */
  release(id: string): void {
    const set = this.owned.get(id)
    this.owned.delete(id)
    for (const dispose of [...(set ?? [])].reverse()) {
      try {
        dispose()
      } catch (e) {
        console.error(`[rig] release failed for "${id}":`, e)
      }
    }
  }
}
