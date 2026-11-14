import { expect, test } from "bun:test";
import { parseManifest } from "../src/plugin/manifest.ts";

const rig = { id: "p", displayName: "P" };
const base = { version: "1.0.0", rig };

test("entry는 플러그인 폴더 안의 상대경로 하나만 허용한다", () => {
  expect(parseManifest({ ...base, rig: { ...rig, entry: "src/index.ts" } }).entry).toBe("src/index.ts");
  expect(parseManifest(base).entry).toBeUndefined(); // UI 전용 플러그인
  for (const bad of ["/etc/passwd", "C:\\x.js", "\\\\host\\x.js", "../core/index.ts", "a/../../b.ts", "", "a\\..\\b.ts"])
    expect(() => parseManifest({ ...base, rig: { ...rig, entry: bad } })).toThrow();
});

test("version은 semver여야 한다", () => {
  for (const ok of ["0.0.0", "1.2.3", "2026.11.14", "1.0.0-beta.1"]) expect(parseManifest({ ...base, version: ok }).version).toBe(ok);
  for (const bad of [1, "1", "1.0", "2026.11.04", "v1.0.0", "2026-11-12", ""]) expect(() => parseManifest({ ...base, version: bad })).toThrow();
  expect(() => parseManifest({ rig })).toThrow(); // 누락
});

test("package.json의 설명, 작성자, 저장소와 rig 항목을 한 객체로 합친다", () => {
  const m = parseManifest({ ...base, description: "d", author: { name: "a" }, repository: "https://x/y" });
  expect(m).toMatchObject({ id: "p", name: "P", version: "1.0.0", description: "d", author: { name: "a" }, repository: "https://x/y" });
  expect(() => parseManifest({ version: "1.0.0" })).toThrow(); // rig 항목 없음
});
