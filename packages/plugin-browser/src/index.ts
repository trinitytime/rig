import type { RigPlugin } from "@rig/core";

const plugin: RigPlugin = {
  activate(ctx) {
    // TODO: implement the "browser" service.
    ctx.log.info("loaded (stub)");
  },
};
export default plugin;
