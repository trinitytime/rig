import { expect, test } from "bun:test";
import { createShared, SharedMemory } from "../src/ctx/shared.ts";
import { Ownership } from "../src/ctx/ownership.ts";
import { CORE_OWNER, DEFAULT_ALLOWED_HOSTS } from "../src/security.ts";
import { createApp } from "../src/server.ts";

function setup() {
  const shared = new SharedMemory(() => {});
  shared.set(CORE_OWNER, "config", "allowedHosts", DEFAULT_ALLOWED_HOSTS, () => () => {});
  return { shared, app: createApp({ shared } as never, { port: 7440 }) };
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

test("허용 목록은 shared의 config/allowedHosts에서 읽고, 플러그인은 바꿀 수 없다", async () => {
  const { shared, app } = setup();
  const o = new Ownership();
  o.open("p");
  const plugin = createShared(shared, "p", (d) => o.track("p", d));
  await expect(plugin.set("config", "allowedHosts", ["evil.com"])).rejects.toThrow("owned by another");
  await expect(plugin.delete("config", "allowedHosts")).rejects.toThrow("owned by another");
  expect(await plugin.get("config", "allowedHosts")).toEqual(DEFAULT_ALLOWED_HOSTS);

  shared.set(CORE_OWNER, "config", "allowedHosts", ["rig.local"], () => () => {});
  expect(await status(app, { host: "rig.local:7440" })).toBe(200);
  expect(await status(app, { host: "127.0.0.1:7440" })).toBe(403);
});
