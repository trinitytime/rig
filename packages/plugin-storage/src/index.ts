import type { RigPlugin } from "@rig/core";

/** `storage` 플러그인 (임시 구현: 메모리 key-value). 제공 함수: storage.get(key), storage.set(key, value) */
// 타입만 import한다: 플러그인은 런타임에 @rig/core를 import하지 않는다.
const plugin: RigPlugin = (ctx) => {
  const map = new Map<string, unknown>();
  ctx.service.provide("get", (key: string) => map.get(key));
  ctx.service.provide("set", (key: string, value: unknown) => void map.set(key, value));
  ctx.log.info("storage service ready");
  return () => map.clear();
};
export default plugin;
