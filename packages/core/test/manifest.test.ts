import { expect, test } from "bun:test";
import { parseManifest } from "../src/plugin/manifest.ts";

const base = { id: "p", name: "P", version: "2026-11-12" };

test("entry는 플러그인 폴더 안의 상대경로 하나만 허용한다", () => {
  expect(parseManifest({ ...base, entry: "src/index.ts" }).entry).toBe("src/index.ts");
  expect(parseManifest(base).entry).toBeUndefined(); // UI 전용 플러그인
  for (const bad of ["/etc/passwd", "C:\\x.js", "\\\\host\\x.js", "../core/index.ts", "a/../../b.ts", "", "a\\..\\b.ts"])
    expect(() => parseManifest({ ...base, entry: bad })).toThrow();
});

test("version은 실제로 있는 YYYY-MM-DD 날짜여야 한다", () => {
  for (const ok of ["2026-11-12", "2020-02-29", "1999-01-01"]) expect(parseManifest({ ...base, version: ok }).version).toBe(ok);
  for (const bad of [1, "1", "2026-1-2", "2026-02-30", "2026-13-01", "2025-02-29", "20261112", ""])
    expect(() => parseManifest({ ...base, version: bad })).toThrow();
  expect(() => parseManifest({ id: "p", name: "P" })).toThrow(); // 누락
});
