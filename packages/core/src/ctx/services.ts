import { z } from "zod";
import type { PluginService } from "../plugin/plugin.js";

type Fn = (...args: any[]) => unknown;

/** 플러그인이 제공하는 함수들의 레지스트리. 키는 `<플러그인 id>.<함수 이름>`. */
export class ServiceRegistry {
  private fns = new Map<string, { owner: string; fn: Fn }>();

  /** 등록하고, 등록을 해제하는 함수를 돌려준다. */
  provide(owner: string, name: string, fn: Fn): () => void {
    const key = `${owner}.${name}`;
    if (this.fns.has(key)) throw new Error(`service "${key}" is already provided`);
    const entry = { owner, fn };
    this.fns.set(key, entry);
    return () => {
      if (this.fns.get(key) === entry) this.fns.delete(key);
    };
  }

  get(key: string): Fn {
    const e = this.fns.get(key);
    if (!e) throw new Error(`service "${key}" is not available`);
    return e.fn;
  }
}

const fnName = z.string().regex(/^[A-Za-z0-9_-]+$/, "must be letters, digits, '-' or '_'");
const target = z.string().regex(/^([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/, "must look like '<plugin id>.<name>'");
const json = z.json();

/**
 * ctx.service. 인자와 반환값은 JSON 값만 허용하고 복사본을 주고받는다(나중에 다른 프로세스로 옮겨도 계약이 같다).
 * call은 항상 Promise를 반환하며, 자기 자신이나 manifest의 requires에 선언한 플러그인의 함수만 부를 수 있다.
 */
export function createService(
  registry: ServiceRegistry,
  id: string,
  requires: readonly string[],
  track: (dispose: () => void) => () => void,
): PluginService {
  const service: PluginService = {
    provide: (name, fn) => track(registry.provide(id, fnName.parse(name), fn)),
    async call(key, ...args) {
      const owner = target.parse(key).split(".")[0]!;
      if (owner !== id && !requires.includes(owner)) throw new Error(`"${owner}" is not declared in requires`);
      json.parse(args);
      const result = await registry.get(key)(...structuredClone(args));
      return (result === undefined ? undefined : structuredClone(json.parse(result))) as never;
    },
  };
  return Object.freeze(service);
}
