import { expect, test } from "bun:test";
import { parseManifest } from "../src/plugin/manifest.ts";

const base = { id: "p", name: "P", version: 1 };

test("entry는 플러그인 폴더 안의 상대경로 하나만 허용한다", () => {
  expect(parseManifest({ ...base, entry: "src/index.ts" }).entry).toBe("src/index.ts");
  expect(parseManifest(base).entry).toBeUndefined(); // UI 전용 플러그인
  for (const bad of ["/etc/passwd", "C:\\x.js", "\\\\host\\x.js", "../core/index.ts", "a/../../b.ts", "", "a\\..\\b.ts"])
    expect(() => parseManifest({ ...base, entry: bad })).toThrow();
});
