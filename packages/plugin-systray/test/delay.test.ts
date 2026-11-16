import { expect, test } from "bun:test";
import { delayFirstWrite } from "../src/delay.ts";

const fake = (writable = true) => {
  const sent: string[] = [];
  const tray = { process: { stdin: { writable } }, writeLine: (l: string) => void sent.push(l) };
  return { tray, sent };
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("첫 줄만 늦게 보내고 두 번째부터는 바로 보낸다", async () => {
  const { tray, sent } = fake();
  delayFirstWrite(tray, 50);
  tray.writeLine("menu");
  expect(sent).toEqual([]);
  tray.writeLine("exit"); // 첫 줄 뒤의 줄은 기다리지 않는다
  expect(sent).toEqual(["exit"]);
  await wait(80);
  expect(sent).toEqual(["exit", "menu"]);
});

test("기다리는 동안 프로세스가 내려갔으면 보내지 않는다", async () => {
  const { tray, sent } = fake();
  delayFirstWrite(tray, 30);
  tray.writeLine("menu");
  tray.process.stdin.writable = false;
  await wait(60);
  expect(sent).toEqual([]);
});
