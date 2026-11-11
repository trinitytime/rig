import { z } from "zod";
import type { PluginLogger, PluginSignal } from "../plugin/plugin.js";

/** 신호 이름: `<발행자 id>:<이벤트>`. 코어가 보내는 신호는 `core:` 로 시작한다. */
const signalName = z.string().regex(/^[A-Za-z0-9_-]+:[A-Za-z0-9_.-]+$/, "must look like '<id>:<event>'");
const eventName = z.string().regex(/^[A-Za-z0-9_.-]+$/, "must be letters, digits, '.', '-' or '_'");

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

/** ctx.signal. emit은 이벤트 이름만 받고, 발행자 id 접두사는 코어가 붙인다(플러그인은 자기 id를 알 수 없다). */
export function createSignal(
  bus: SignalBus,
  id: string,
  track: (dispose: () => void) => () => void,
  log: PluginLogger,
): PluginSignal {
  const signal: PluginSignal = {
    on: (name, fn) => track(bus.on(signalName.parse(name), fn, log)),
    emit: (event, payload) => bus.emit(`${id}:${eventName.parse(event)}`, payload),
  };
  return Object.freeze(signal);
}
