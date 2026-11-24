import { expect, test } from "bun:test";
import { HttpRouter } from "../src/ctx/http.ts";
import { createApp } from "../src/server.ts";
import { SharedMemory } from "../src/ctx/shared.ts";
import { SignalBus } from "../src/ctx/signal.ts";
import { Ownership } from "../src/ctx/ownership.ts";

const H = { host: "127.0.0.1" };
const log = { info() {}, warn() {}, error() {} };

test("/<id>/* 요청은 접두사를 뗀 경로로 핸들러에 전달되고, 해제·예외·예약 id를 처리한다", async () => {
  const http = new HttpRouter();
  const app = createApp({ http, shared: new SharedMemory(() => {}), signals: new SignalBus(), list: () => [] } as never);
  const o = new Ownership();
  o.open("p");
  o.track("p", http.register("p", async (req) => Response.json({ path: new URL(req.url).pathname, body: await req.text() }), log));

  const res = await app.request("/p/items/1?x=2", { method: "POST", body: "hi", headers: H });
  expect(await res.json()).toEqual({ path: "/items/1", body: "hi" });
  expect((await (await app.request("/p", { headers: H })).json()).path).toBe("/");

  // 인코딩된 id 표기에서도 플러그인은 같은 경로를 받는다
  http.register("plugin-a", async (req) => Response.json(new URL(req.url).pathname), log);
  for (const p of ["/plugin-a/items", "/%70lugin-a/items", "/plugin%2Da/items"])
    expect(await (await app.request(p, { headers: H })).json()).toBe("/items");
  expect((await app.request("/%E0%A4%A/x", { headers: H })).status).toBe(404);

  for (const id of ["api", "health"]) expect(() => http.register(id, () => new Response(), log)).toThrow("reserved");
  expect((await app.request("/api/other", { headers: H })).status).toBe(404); // 예약 id라 플러그인으로 가지 않는다
  http.register("bad", () => { throw new Error("x"); }, log);
  expect((await app.request("/bad/x", { headers: H })).status).toBe(500);

  o.release("p");
  expect((await app.request("/p/items", { headers: H })).status).toBe(404);
});
