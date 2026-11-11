import { expect, test } from "bun:test";
import { Ownership } from "../src/ownership.js";

test("release는 id의 등록을 역순으로 모두 해제하고, 이후 track은 거부한다", () => {
  const o = new Ownership();
  const calls: string[] = [];
  o.open("a");
  o.open("b");
  o.track("a", () => calls.push("a1"));
  o.track("a", () => calls.push("a2"));
  o.track("b", () => calls.push("b1"));
  o.release("a");
  expect(calls).toEqual(["a2", "a1"]);
  expect(() => o.track("a", () => calls.push("late"))).toThrow();
  expect(calls).toEqual(["a2", "a1", "late"]); // 늦은 등록도 바로 해제된다
  o.release("b");
  expect(calls.at(-1)).toBe("b1");
});

test("개별 해제 함수는 한 번만 동작한다", () => {
  const o = new Ownership();
  let n = 0;
  o.open("a");
  const off = o.track("a", () => n++);
  off();
  off();
  o.release("a");
  expect(n).toBe(1);
});
