import { expect, test } from "bun:test";
import { Ownership } from "../src/ownership.js";
import { createService, ServiceRegistry } from "../src/services.js";

function plugin(reg: ServiceRegistry, o: Ownership, id: string, requires: string[] = []) {
  o.open(id);
  return createService(reg, id, requires, (d) => o.track(id, d));
}

test("requires에 선언한 플러그인의 함수를 호출하고, 미선언이면 거부한다", async () => {
  const reg = new ServiceRegistry();
  const o = new Ownership();
  const storage = plugin(reg, o, "storage");
  const user = plugin(reg, o, "user", ["storage"]);
  const other = plugin(reg, o, "other");
  const map = new Map<string, unknown>();
  storage.provide("set", (k: string, v: unknown) => void map.set(k, v));
  storage.provide("get", (k: string) => map.get(k));
  await user.call("storage.set", "a", { n: 1 });
  expect(await user.call("storage.get", "a")).toEqual({ n: 1 });
  expect(await user.call("storage.get", "none")).toBeUndefined();
  await expect(other.call("storage.get", "a")).rejects.toThrow("requires");
});

test("release하면 함수가 사라지고, JSON이 아닌 인자와 중복 등록은 거부한다", async () => {
  const reg = new ServiceRegistry();
  const o = new Ownership();
  const a = plugin(reg, o, "a");
  a.provide("f", () => 1);
  expect(() => a.provide("f", () => 2)).toThrow();
  await expect(a.call("a.f", () => {})).rejects.toThrow();
  o.release("a");
  await expect(plugin(reg, o, "b", ["a"]).call("a.f")).rejects.toThrow("not available");
});
