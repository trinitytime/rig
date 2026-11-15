import { afterAll, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installedPluginsPage } from "../../src/pages/installed-plugins/page.ts";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "rig-installed-page-"));
process.env.RIG_HOME = home;
afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

const dir = path.join(home, "plugins", "node_modules", "p1");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "package.json"),
  JSON.stringify({ name: "p1", version: "1.2.3", author: { name: "kim" }, rig: { id: "p1", displayName: "P1" } }),
);

test("스캔한 플러그인을 row로 보여주고 설치 목록의 활성 여부를 반영한다", () => {
  const page = installedPluginsPage([{ id: "p1", source: "user", enabled: true }], { busy: false, path: "", archive: "" });
  expect(page.items[0]).toMatchObject({ type: "button", id: "refresh" });
  const rows = (page.items[2] as any).items;
  const p1 = rows.find((r: any) => r.label === "P1");
  expect(p1.meta).toBe("v1.2.3 · kim · user");
  expect(p1.description).toBeUndefined();
  expect(p1.items[0]).toMatchObject({ type: "toggle", value: true });
  expect(rows.find((r: any) => r.label === "Dashboard").items[0].value).toBe(false); // 목록에 없으면 비활성
  expect(() => structuredClone(page)).not.toThrow();
});
