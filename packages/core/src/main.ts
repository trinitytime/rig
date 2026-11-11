import { PluginLoader } from "./loader.js";
import { startServer } from "./server.js";

const loader = new PluginLoader();
const statuses = await loader.loadAll();
for (const s of statuses) console.log(`[rig] plugin ${s.id}: ${s.state}${s.error ? ` (${s.error})` : ""}`);

const server = startServer({ loader });

const shutdown = async () => {
  server.close();
  await loader.unloadAll();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
