import { expect, test } from "bun:test";
import { Ownership } from "../src/ownership.js";
import { createSignal, SignalBus } from "../src/signal.js";

const log = { info() {}, warn() {}, error() {} };
const tick = () => new Promise((r) => setTimeout(r, 5));

function plugin(bus: SignalBus, o: Ownership, id: string) {
  o.open(id);
  return createSignal(bus, id, (d) => o.track(id, d), log);
}

test("emit은 id 접두사를 붙여 구독자에게 복사본을 보내고, 한 구독자의 예외는 다른 구독자에 영향이 없다", async () => {
  const bus = new SignalBus();
  const o = new Ownership();
  const a = plugin(bus, o, "a");
  const b = plugin(bus, o, "b");
  const got: unknown[] = [];
  b.on("a:ready", () => { throw new Error("boom"); });
  b.on("a:ready", (p) => void got.push(p));
  const payload = { n: 1 };
  a.emit("ready", payload);
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
  b.on("a:x", () => void n++);
  o.release("b");
  a.emit("x");
  await tick();
  expect(n).toBe(0);
  expect(() => a.on("nocolon", () => {})).toThrow();
  expect(() => a.emit("bad name")).toThrow();
  expect(() => a.emit("x", () => {})).toThrow();
});
