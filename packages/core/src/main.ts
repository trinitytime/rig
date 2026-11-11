import { PluginLoader } from "./plugin/loader.ts";
import { startServer } from "./server.ts";

const loader = new PluginLoader();
const statuses = await loader.loadAll();
for (const s of statuses) console.log(`[rig] plugin ${s.id}: ${s.state}${s.error ? ` (${s.error})` : ""}`);

const server = startServer({ loader });

let closing = false;
const shutdown = async () => {
  if (closing) return; // 신호가 두 번 와도 한 번만 정리한다
  closing = true;
  server.close();
  await loader.unloadAll();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
