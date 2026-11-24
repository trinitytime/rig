import { expect, test } from "bun:test";
import { Ownership } from "../src/ctx/ownership.ts";
import { createSignal, SignalBus } from "../src/ctx/signal.ts";

const log = { info() {}, warn() {}, error() {} };
const tick = () => new Promise((r) => setTimeout(r, 5));

function plugin(bus: SignalBus, o: Ownership, id: string) {
  o.open(id);
  return createSignal(bus, (d) => o.track(id, d), log);
}

test("emit한 이름 그대로 모든 구독자에게 복사본을 보내고, 한 구독자의 예외는 다른 구독자에 영향이 없다", async () => {
  const bus = new SignalBus();
  const o = new Ownership();
  const a = plugin(bus, o, "a");
  const b = plugin(bus, o, "b");
  const got: unknown[] = [];
  b.on("hello", () => { throw new Error("boom"); });
  b.on("hello", (p) => void got.push(p));
  const payload = { n: 1 };
  a.emit("hello", payload);
  await tick();
  expect(got).toEqual([{ n: 1 }]);
  expect(got[0]).not.toBe(payload);
});

test("release 뒤에는 구독이 사라지고, 잘못된 이름과 payload는 거부한다", async () => {
  const bus = new SignalBus();
  const o = new Ownership();
  const a = plugin(bus, o, "a");
  const b = plugin(bus, o, "b");
  let n = 0;
  b.on("x", () => void n++);
  o.release("b");
  a.emit("x");
  await tick();
  expect(n).toBe(0);
  expect(() => a.on("bad name", () => {})).toThrow();
  expect(() => a.emit("bad name")).toThrow();
  expect(() => a.emit("shared:ws")).toThrow("reserved");
  expect(() => a.emit("x", () => {})).toThrow();
});
