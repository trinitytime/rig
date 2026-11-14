import { expect, test } from "bun:test";
import { Ownership } from "../src/ctx/ownership.ts";
import { createTimer } from "../src/ctx/timer.ts";

const log = { info() {}, warn() {}, error() {} };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup() {
  const o = new Ownership();
  o.open("p");
  return { o, timer: createTimer((d) => o.track("p", d), log) };
}

test("interval은 release 뒤에 멈추고, 겹치는 실행은 건너뛴다", async () => {
  const { o, timer } = setup();
  let n = 0;
  timer.setInterval(async () => { n++; await sleep(35); }, 10);
  await sleep(60);
  expect(n).toBe(2); // 35ms짜리 실행 동안의 틱은 건너뜀
  o.release("p");
  const after = n;
  await sleep(60);
  expect(n).toBe(after);
});

test("콜백 예외는 던지지 않고, 잘못된 인자는 거부한다", async () => {
  const { timer } = setup();
  timer.setTimeout(() => { throw new Error("x"); }, 0);
  await sleep(10);
  expect(() => timer.setInterval(() => {}, 1)).toThrow();
  expect(() => timer.setTimeout(() => {}, -1)).toThrow();
});

test("debounce는 연속 호출을 마지막 호출 뒤 한 번으로 묶고, release 뒤에는 실행하지 않는다", async () => {
  const { o, timer } = setup();
  let n = 0;
  const d = timer.debounce(() => { n++; }, 30);
  d(); await sleep(15); d(); await sleep(15); d();
  expect(n).toBe(0);
  await sleep(50);
  expect(n).toBe(1);
  d(); o.release("p");
  await sleep(50);
  expect(n).toBe(1);
});
