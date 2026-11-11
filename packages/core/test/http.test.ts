import { expect, test } from "bun:test";
import { HttpRouter } from "../src/ctx/http.ts";
import { createApp } from "../src/server.ts";
import { Ownership } from "../src/ctx/ownership.ts";

const log = { info() {}, warn() {}, error() {} };

test("/api/<id>/* 요청은 접두사를 뗀 경로로 핸들러에 전달되고, 해제·예외·예약 id를 처리한다", async () => {
  const http = new HttpRouter();
  const app = createApp({ http, list: () => [] } as never);
  const o = new Ownership();
  o.open("p");
  o.track("p", http.register("p", async (req) => Response.json({ path: new URL(req.url).pathname, body: await req.text() }), log));

  const res = await app.request("/api/p/items/1?x=2", { method: "POST", body: "hi" });
  expect(await res.json()).toEqual({ path: "/items/1", body: "hi" });
  expect((await (await app.request("/api/p")).json()).path).toBe("/");

  expect(() => http.register("plugins", () => new Response(), log)).toThrow("reserved");
  http.register("bad", () => { throw new Error("x"); }, log);
  expect((await app.request("/api/bad/x")).status).toBe(500);

  o.release("p");
  expect((await app.request("/api/p/items")).status).toBe(404);
});
