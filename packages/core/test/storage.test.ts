import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStorage } from "../src/ctx/storage.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "rig-storage-"));

test("save한 값을 data.json에 그대로 저장하고 load로 읽는다", async () => {
  const dir = tmp();
  const s = createStorage(dir);
  expect(await s.load()).toBeUndefined(); // 저장한 적 없음
  await s.save({ a: 1, b: [true, null, "x"] });
  expect(JSON.parse(fs.readFileSync(path.join(dir, "data.json"), "utf8"))).toEqual({ a: 1, b: [true, null, "x"] });
  expect(await s.load()).toEqual({ a: 1, b: [true, null, "x"] });
  await s.save(null);
  expect(await s.load()).toBeNull();
  await s.save("overwrite");
  expect(await createStorage(dir).load()).toBe("overwrite"); // 다른 인스턴스(재시작)에서도 읽힘
  expect(fs.readdirSync(dir)).toEqual(["data.json"]); // 임시 파일이 남지 않음
});

test("동시에 save해도 마지막 값이 남고 파일이 깨지지 않으며, 잘못된 값은 거부한다", async () => {
  const dir = tmp();
  const s = createStorage(dir);
  await Promise.all(Array.from({ length: 20 }, (_, i) => s.save({ i })));
  expect(await s.load()).toEqual({ i: 19 });
  await expect(s.save(() => {})).rejects.toThrow();
  await expect(s.save(undefined)).rejects.toThrow();
  expect(await s.load()).toEqual({ i: 19 }); // 거부된 값은 기존 파일을 건드리지 않음
});

test("data.json이 깨져 있으면 load가 던진다", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "data.json"), "{broken");
  await expect(createStorage(dir).load()).rejects.toThrow();
});
