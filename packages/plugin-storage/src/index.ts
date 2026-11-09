import type { RigPlugin } from "@rig/core";

/** `storage` 서비스 (임시 구현: 메모리 key-value). */
export interface StorageService {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

// 타입만 import한다: 플러그인은 런타임에 @rig/core를 import하지 않는다.
const plugin: RigPlugin = {
  activate(ctx) {
    const map = new Map<string, unknown>();
    const svc: StorageService = { get: (k) => map.get(k), set: (k, v) => void map.set(k, v) };
    ctx.services.provide(svc);
    ctx.log.info("storage service ready");
  },
};
export default plugin;
