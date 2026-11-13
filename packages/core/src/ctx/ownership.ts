/** 등록한 것의 해제 함수를 기록하고, 개별 해제용 함수를 돌려준다. (ctx 안에서 플러그인 id에 묶여 만들어진다) */
/** first가 true면 해제할 때 다른 등록보다 먼저 해제한다 (신호 구독처럼, 정리 중 발생하는 신호를 받지 않아야 하는 것). */
export type Track = (dispose: () => void, first?: boolean) => () => void

/** 플러그인 id별로, ctx를 통해 등록된 것들의 해제 함수를 모아 둔다. */
export class Ownership {
  private owned = new Map<string, Set<{ dispose: () => void; first: boolean }>>()

  /** 플러그인 활성화 직전에 호출. */
  open(id: string): void {
    this.owned.set(id, new Set())
  }

  /** 등록된 것의 해제 함수를 기록하고, 개별 해제용 함수를 돌려준다. 열려 있지 않은 id면 바로 해제하고 던진다. */
  track(id: string, dispose: () => void, first = false): () => void {
    const set = this.owned.get(id)
    if (!set) {
      dispose()
      throw new Error(`plugin "${id}" is not active`)
    }
    const entry = { dispose, first }
    set.add(entry)
    return () => {
      if (set.delete(entry)) dispose()
    }
  }

  /** 이 id의 등록을 모두 역순으로 해제하고 닫는다. 이후의 track은 거부된다. */
  release(id: string): void {
    const set = this.owned.get(id)
    this.owned.delete(id)
    // 등록의 역순이되, first 등록(신호 구독)은 모두 먼저 해제한다.
    const entries = [...(set ?? [])].reverse()
    for (const { dispose } of [...entries.filter((e) => e.first), ...entries.filter((e) => !e.first)]) {
      try {
        dispose()
      } catch (e) {
        console.error(`[rig] release failed for "${id}":`, e)
      }
    }
  }
}
