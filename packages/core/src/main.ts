import { PluginLoader } from "./plugin/loader.ts";
import { startServer } from "./server.ts";

const loader = new PluginLoader();
let server: Awaited<ReturnType<typeof startServer>> | undefined;
let closing = false;
const shutdown = async () => {
  if (closing) return; // 신호가 두 번 와도 한 번만 정리한다
  closing = true;
  server?.close(); // 서버가 뜨기 전에 호출될 수도 있다
  await loader.unloadAll();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// 초기화: 트레이에 Exit 항목을 넣고, 그 signal을 받으면 종료한다. 코어는 프로세스와 수명이 같아 해제 함수는 필요 없다.
loader.shared.set("core", "tray", "exit", { id: "exit", name: "Exit", signal: "core:exit", order: 9999 }, () => () => {});
loader.signals.on("core:exit", () => shutdown(), console);
// 서버가 완전히 뜬 뒤에 플러그인을 로드한다 (로드 중에도 /health 등에 응답하고, 플러그인 API는 로드되는 대로 열린다).
server = await startServer({ loader });
const statuses = await loader.loadAll();
for (const s of statuses) console.log(`[rig] plugin ${s.id}: ${s.state}${s.error ? ` (${s.error})` : ""}`);
