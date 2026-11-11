import { z } from "zod";
import type { PluginLogger, PluginTimer } from "../plugin/plugin.ts";

/** setInterval의 최소 주기. 이보다 짧으면 거부한다. */
export const MIN_INTERVAL_MS = 10;
const delaySchema = z.number().finite().nonnegative().max(2 ** 31 - 1);
const intervalSchema = delaySchema.min(MIN_INTERVAL_MS);

/**
 * 코어가 제공하는 타이머. 등록은 track으로 기록되어 플러그인이 내려갈 때 모두 해제된다.
 * 콜백의 예외는 로그만 남기고, 이전 실행이 끝나지 않은 주기 호출은 건너뛴다.
 */
export function createTimer(track: (dispose: () => void) => () => void, log: PluginLogger): PluginTimer {
  const safe = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      log.error("timer callback failed:", e);
    }
  };
  const timer: PluginTimer = {
    setTimeout(fn, delay) {
      const t = setTimeout(() => {
        off();
        void safe(fn);
      }, delaySchema.parse(delay));
      const off = track(() => clearTimeout(t));
      return off;
    },
    setInterval(fn, interval) {
      let running = false;
      const t = setInterval(() => {
        if (running) return;
        running = true;
        void safe(fn).finally(() => (running = false));
      }, intervalSchema.parse(interval));
      return track(() => clearInterval(t));
    },
  };
  return Object.freeze(timer);
}
