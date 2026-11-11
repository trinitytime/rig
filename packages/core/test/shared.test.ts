import { expect, test } from "bun:test";
import { Ownership } from "../src/ctx/ownership.ts";
import { createShared, SharedMemory } from "../src/ctx/shared.ts";

function plugin(mem: SharedMemory, o: Ownership, id: string) {
  o.open(id);
  return createShared(mem, id, (d) => o.track(id, d));
}

test("workspace는 처음 쓴 플러그인이 소유하고, 소유자만 쓰며, 누구나 읽는다 (복사본)", async () => {
  const mem = new SharedMemory();
  const o = new Ownership();
  const a = plugin(mem, o, "a");
  const b = plugin(mem, o, "b");
  const v = { n: 1 };
  await a.set("ws", "k1", v);
  await a.set("ws", "k2", "x");
  expect(await b.get("ws", "k1")).toEqual({ n: 1 });
  expect(await b.get("ws", "k1")).not.toBe(v);
  expect(await b.get("ws")).toEqual({ k1: { n: 1 }, k2: "x" });
  expect(await b.get("none", "k")).toBeUndefined();
  expect(await b.get("none")).toEqual({});
  await expect(b.set("ws", "k1", 2)).rejects.toThrow("owned by another");
  await expect(b.delete("ws")).rejects.toThrow("owned by another");
});

test("delete는 key 또는 workspace 전체를 지우고, 소유자가 비활성화되면 workspace가 사라지며 이후 쓰기는 거부된다", async () => {
  const mem = new SharedMemory();
  const o = new Ownership();
  const a = plugin(mem, o, "a");
  await a.set("ws", "k1", 1);
  await a.set("ws", "k2", 2);
  await a.delete("ws", "k1");
  expect(await a.get("ws")).toEqual({ k2: 2 });
  o.release("a");
  expect(await a.get("ws")).toEqual({});
  await expect(a.set("ws", "k", 1)).rejects.toThrow();
  expect(await a.get("ws")).toEqual({}); // 거부된 쓰기는 workspace를 만들지 않음
  const b = plugin(mem, o, "b");
  await b.set("ws", "k", 1); // 소유자가 사라진 이름은 다른 플러그인이 다시 만들 수 있음
  expect(await b.get("ws", "k")).toBe(1);
});

test("잘못된 이름과 JSON이 아닌 값은 거부한다", async () => {
  const a = plugin(new SharedMemory(), new Ownership(), "a");
  await expect(a.set("bad name", "k", 1)).rejects.toThrow();
  await expect(a.set("ws", "k", () => {})).rejects.toThrow();
  await expect(a.set("ws", "k", undefined)).rejects.toThrow();
});
