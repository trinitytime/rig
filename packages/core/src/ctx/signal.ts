import { z } from "zod";
import type { PluginLogger, PluginSignal } from "../plugin/plugin.ts";
import type { Track } from "./ownership.ts";

/** 신호 이름. 접두사 없이 모든 플러그인이 같은 이름 공간을 쓴다 (`shared:<workspace>` 처럼 콜론을 쓸 수 있다). */
const signalName = z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/, "must be 1-128 chars of letters, digits, '.', ':', '-' or '_'");
/** 코어가 보내는 신호의 접두사. 플러그인은 이 접두사로 emit할 수 없다. */
const RESERVED_PREFIXES = ["shared:"];

type Handler = { fn: (payload: unknown) => void | Promise<void>; log: PluginLogger };

/** 1:N 알림 버스. 발행자는 구독자를 기다리지 않고, 한 구독자의 예외는 다른 구독자에게 영향이 없다. */
export class SignalBus {
  private handlers = new Map<string, Set<Handler>>();

  on(signal: string, fn: Handler["fn"], log: PluginLogger): () => void {
    const h: Handler = { fn, log };
    let set = this.handlers.get(signal);
    if (!set) this.handlers.set(signal, (set = new Set()));
    set.add(h);
    return () => void this.handlers.get(signal)?.delete(h);
  }

  /** payload는 JSON 직렬화 가능한 값만 허용한다. 구독자마다 복사본을 받는다. */
  emit(signal: string, payload?: unknown): void {
    z.json().optional().parse(payload);
    for (const h of [...(this.handlers.get(signal) ?? [])]) {
      queueMicrotask(async () => {
        try {
          await h.fn(structuredClone(payload));
        } catch (e) {
          h.log.error(`signal handler for "${signal}" failed:`, e);
        }
      });
    }
  }
}

/** ctx.signal. 플러그인이 emit한 이름 그대로 모든 구독자에게 전달된다. */
export function createSignal(
  bus: SignalBus,
  track: Track,
  log: PluginLogger,
): PluginSignal {
  const signal: PluginSignal = {
    on: (name, fn) => track(bus.on(signalName.parse(name), fn, log)),
    emit(name, payload) {
      signalName.parse(name);
      if (RESERVED_PREFIXES.some((p) => name.startsWith(p))) throw new Error(`"${name}" is reserved for the core`);
      bus.emit(name, payload);
    },
  };
  return Object.freeze(signal);
}
