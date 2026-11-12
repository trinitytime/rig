import { expect, test } from "bun:test";
import { parseManifest, RIG_API_VERSION } from "../src/plugin/manifest.ts";

const base = { id: "p", name: "P", version: RIG_API_VERSION };

test("entry는 플러그인 폴더 안의 상대경로 하나만 허용한다", () => {
  expect(parseManifest({ ...base, entry: "src/index.ts" }).entry).toBe("src/index.ts");
  expect(parseManifest(base).entry).toBeUndefined(); // UI 전용 플러그인
  for (const bad of ["/etc/passwd", "C:\\x.js", "\\\\host\\x.js", "../core/index.ts", "a/../../b.ts", "", "a\\..\\b.ts"])
    expect(() => parseManifest({ ...base, entry: bad })).toThrow();
});

test("version은 호스트와 같은 YYYY-MM-DD 날짜여야 한다", () => {
  expect(parseManifest(base).version).toBe(RIG_API_VERSION);
  for (const bad of [1, "1", "2026-1-2", "2026-02-30", "2026-13-01", "2025-01-01", "20261112", ""])
    expect(() => parseManifest({ ...base, version: bad })).toThrow();
  expect(() => parseManifest({ id: "p", name: "P" })).toThrow(); // 누락
});
