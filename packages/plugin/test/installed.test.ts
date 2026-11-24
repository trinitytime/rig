import { afterAll, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readConfig } from "../src/config.ts";
import { loadInstalled } from "../src/plugin/registry.ts";
import { resolvePort } from "../src/server.ts";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "rig-installed-"));
process.env.RIG_HOME = home;
process.chdir(home); // config.json은 현재 폴더에서 읽는다
afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

test("포트는 환경 변수 > 설정 파일 > 기본 포트 순이다", () => {
  expect(resolvePort("8080", 9000)).toBe(8080);
  expect(resolvePort(undefined, 9000)).toBe(9000);
  expect(resolvePort(undefined, undefined)).toBe(7440);
  expect(() => resolvePort(undefined, 70000)).toThrow("config port");
});

test("설정 파일이 없으면 빈 설정이고, 잘못되면 던진다", () => {
  expect(readConfig()).toEqual({});
  fs.writeFileSync(path.join(home, "config.json"), "{ nope");
  expect(() => readConfig()).toThrow("config.json");
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ port: 9000, plugins: { systray: false } }));
  expect(readConfig().port).toBe(9000);
});

test("목록 파일이 없으면 탐색해 만들고 설정의 활성 여부를 적용해 저장한다. 있으면 설정은 무시한다", () => {
  const list = loadInstalled({ plugins: { systray: false } });
  expect(list.find((p) => p.id === "systray")).toEqual({ id: "systray", source: "builtin", enabled: false });
  expect(list.find((p) => p.id === "dashboard")?.enabled).toBe(false); // 적혀 있지 않으면 비활성
  expect(fs.existsSync(path.join(home, "data", "core", "installed-plugins.json"))).toBe(true);
  expect(loadInstalled({ plugins: { systray: true } }).find((p) => p.id === "systray")?.enabled).toBe(false);
});
