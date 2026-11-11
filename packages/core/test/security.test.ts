import { expect, test } from "bun:test";
import { createShared, SharedMemory } from "../src/ctx/shared.ts";
import { SignalBus } from "../src/ctx/signal.ts";
import { Ownership } from "../src/ctx/ownership.ts";
import { createApp, resolvePort } from "../src/server.ts";

const tick = () => new Promise((r) => setTimeout(r, 5));

function setup(emitSignals = true) {
  const signals = new SignalBus();
  const shared = new SharedMemory((s, p) => (emitSignals ? signals.emit(s, p) : undefined));
  const o = new Ownership();
  o.open("p");
  const plugin = createShared(shared, "p", (d) => o.track("p", d));
  return { plugin, app: createApp({ shared, signals } as never, { port: 7440 }) };
}
const status = async (app: ReturnType<typeof createApp>, headers: Record<string, string>) =>
  (await app.request("/health", { headers })).status;

test("허용된 Host는 통과하고, Origin이 없으면(curl 등) 통과한다", async () => {
  const { app } = setup();
  expect(await status(app, { host: "127.0.0.1:7440" })).toBe(200);
  expect(await status(app, { host: "localhost:7440" })).toBe(200);
});

test("허용되지 않은 Host(DNS rebinding)는 403이다", async () => {
  const { app } = setup();
  expect(await status(app, { host: "evil.com:7440" })).toBe(403);
  expect(await status(app, { host: "127.0.0.1:9999" })).toBe(403);
  expect(await status(app, {})).toBe(403);
});

test("다른 사이트의 Origin과 cross-site 요청은 403이고, 같은 출처는 통과한다", async () => {
  const { app } = setup();
  const host = "127.0.0.1:7440";
  expect(await status(app, { host, origin: "http://localhost:7440" })).toBe(200);
  expect(await status(app, { host, origin: "http://evil.com" })).toBe(403);
  expect(await status(app, { host, origin: "http://localhost:3000" })).toBe(403);
  expect(await status(app, { host, origin: "https://localhost:7440" })).toBe(403);
  expect(await status(app, { host, origin: "null" })).toBe(403);
  expect(await status(app, { host, "sec-fetch-site": "cross-site" })).toBe(403);
  expect(await status(app, { host, "sec-fetch-site": "same-origin" })).toBe(200);
});

test("config/allowedHosts가 있으면 기본값과 합쳐 쓰고, 없어지거나 잘못되면 기본값만 쓴다 (신호가 올 때 반영)", async () => {
  const { plugin, app } = setup();
  const rig = { host: "rig.local:7440" };
  const loop = { host: "127.0.0.1:7440" };
  expect(await status(app, rig)).toBe(403);
  await plugin.set("config", "allowedHosts", ["rig.local"]);
  await tick();
  expect(await status(app, rig)).toBe(200);
  expect(await status(app, loop)).toBe(200); // 기본값은 유지
  await plugin.set("config", "allowedHosts", "not-an-array");
  await tick();
  expect(await status(app, rig)).toBe(403);
  expect(await status(app, loop)).toBe(200);
  await plugin.set("config", "allowedHosts", ["rig.local"]);
  await plugin.delete("config", "allowedHosts");
  await tick();
  expect(await status(app, rig)).toBe(403);
});

test("신호가 없으면 요청마다 다시 읽지 않는다", async () => {
  const { plugin, app } = setup(false);
  await plugin.set("config", "allowedHosts", ["rig.local"]);
  await tick();
  expect(await status(app, { host: "rig.local:7440" })).toBe(403);
});

test("시작 전에 이미 있는 값은 시작할 때 반영한다", async () => {
  const signals = new SignalBus();
  const shared = new SharedMemory(() => {});
  const o = new Ownership();
  o.open("p");
  await createShared(shared, "p", (d) => o.track("p", d)).set("config", "allowedHosts", ["rig.local"]);
  const app = createApp({ shared, signals } as never, { port: 7440 });
  expect(await status(app, { host: "rig.local:7440" })).toBe(200);
});

test("RIG_PORT는 1~65535 정수만 허용하고 없으면 기본 포트를 쓴다", () => {
  expect(resolvePort(undefined)).toBe(7440);
  expect(resolvePort("8080")).toBe(8080);
  for (const bad of ["abc", "0", "65536", "1.5", ""]) expect(() => resolvePort(bad)).toThrow("RIG_PORT");
});
