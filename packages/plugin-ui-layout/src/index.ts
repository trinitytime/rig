import type { RigPlugin } from "@rig/core";

// 타입만 import한다: 플러그인은 런타임에 @rig/core를 import하지 않는다.
const plugin: RigPlugin = (ctx) => {
  // TODO: implement the "ui-layout" service.
  ctx.log.info("loaded (stub)");
};
export default plugin;
