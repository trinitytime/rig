import { expect, test } from "bun:test";
import { Ownership } from "../src/ctx/ownership.ts";
import { createShared, SharedMemory } from "../src/ctx/shared.ts";

const noEmit = () => {};

function plugin(mem: SharedMemory, o: Ownership, id: string) {
  o.open(id);
  return createShared(mem, id, (d) => o.track(id, d));
}

test("key마다 소유자가 있고, 같은 workspace에 다른 플러그인이 다른 key를 쓸 수 있으며, 읽기는 누구나 (복사본)", async () => {
  const mem = new SharedMemory(noEmit);
  const o = new Ownership();
  const a = plugin(mem, o, "a");
  const b = plugin(mem, o, "b");
  const v = { n: 1 };
  await a.set("ws", "k1", v);
  await b.set("ws", "k2", "x");
  expect(await b.get("ws", "k1")).toEqual({ n: 1 });
  expect(await b.get("ws", "k1")).not.toBe(v);
  expect(await a.get("ws")).toEqual({ k1: { n: 1 }, k2: "x" });
  expect(await a.get("none", "k")).toBeUndefined();
  expect(await a.get("none")).toEqual({});
  await expect(b.set("ws", "k1", 2)).rejects.toThrow("owned by another");
  await expect(b.delete("ws", "k1")).rejects.toThrow("owned by another");
  await expect(b.set("ws", "k1", null)).rejects.toThrow("owned by another");
  await a.set("ws", "k1", 3); // 소유자는 갱신 가능
  expect(await b.get("ws", "k1")).toBe(3);
});

test("delete나 null/undefined 쓰기는 삭제이며 소유권도 사라진다", async () => {
  const mem = new SharedMemory(noEmit);
  const o = new Ownership();
  const a = plugin(mem, o, "a");
  const b = plugin(mem, o, "b");
  await a.set("ws", "k1", 1);
  await a.set("ws", "k2", 2);
  await a.set("ws", "k3", 3);
  await a.delete("ws", "k1");
  await a.set("ws", "k2", null);
  await a.set("ws", "k3", undefined);
  expect(await a.get("ws")).toEqual({});
  await b.set("ws", "k1", "mine"); // 소유권이 없어졌으므로 다른 플러그인이 새로 소유 가능
  expect(await a.get("ws", "k1")).toBe("mine");
  await a.delete("ws", "none"); // 없는 key 삭제는 무시
  await b.set("ws", "none", null);
});

test("소유자가 비활성화되면 그 플러그인의 key만 사라지고, 이후 쓰기는 거부된다", async () => {
  const mem = new SharedMemory(noEmit);
  const o = new Ownership();
  const a = plugin(mem, o, "a");
  const b = plugin(mem, o, "b");
  await a.set("ws", "ka", 1);
  await b.set("ws", "kb", 2);
  o.release("a");
  expect(await b.get("ws")).toEqual({ kb: 2 });
  await expect(a.set("ws", "late", 1)).rejects.toThrow();
  expect(await b.get("ws")).toEqual({ kb: 2 });
});

test("잘못된 이름과 JSON이 아닌 값은 거부한다", async () => {
  const a = plugin(new SharedMemory(noEmit), new Ownership(), "a");
  await expect(a.set("bad name", "k", 1)).rejects.toThrow();
  await expect(a.set("ws", "k", () => {})).rejects.toThrow();
});

test("변경이 생기면 shared:<workspace> 신호를 보낸다 (set, delete, null 쓰기, 소유자 비활성화)", async () => {
  const sent: [string, unknown][] = [];
  const mem = new SharedMemory((s, p) => sent.push([s, p]));
  const o = new Ownership();
  const a = plugin(mem, o, "a");
  await a.set("ws", "k1", { n: 1 });
  await a.set("ws", "k1", 2);
  await a.set("ws", "k2", 3);
  await a.delete("ws", "k1");
  await a.set("ws", "k2", null);
  await a.set("ws", "k3", 4);
  o.release("a");
  await a.delete("ws", "none"); // 없는 key는 알리지 않음
  expect(sent).toEqual([
    ["shared:ws", { key: "k1", type: "set", value: { n: 1 } }],
    ["shared:ws", { key: "k1", type: "set", value: 2 }],
    ["shared:ws", { key: "k2", type: "set", value: 3 }],
    ["shared:ws", { key: "k1", type: "delete" }],
    ["shared:ws", { key: "k2", type: "delete" }],
    ["shared:ws", { key: "k3", type: "set", value: 4 }],
    ["shared:ws", { key: "k3", type: "delete" }],
  ]);
});
