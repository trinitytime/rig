import { afterAll, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PluginLoader } from "../src/plugin/loader.ts";

// <RIG_HOME>/plugins/node_modules/ 아래에 시험용 플러그인을 만들어 loadAll을 돌린다 (내장 플러그인은 같이 로드되지만 무시한다).
const home = fs.mkdtempSync(path.join(os.tmpdir(), "rig-loader-"));
const outside = path.join(home, "outside.ts");
process.env.RIG_HOME = home;
afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

const events: string[] = (globalThis as any).__rigEvents = [];

function plugin(id: string, opts: { requires?: string[]; body?: string; entry?: string | false } = {}) {
  const dir = path.join(home, "plugins", "node_modules", id);
  fs.mkdirSync(dir, { recursive: true });
  const manifest: Record<string, unknown> = { id, name: id, apiVersion: 1, requires: opts.requires ?? [] };
  if (opts.entry !== false) manifest.entry = opts.entry ?? "index.ts";
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  fs.writeFileSync(
    path.join(dir, "index.ts"),
    `export default () => { ${opts.body ?? ""}; globalThis.__rigEvents.push("up:${id}"); return () => globalThis.__rigEvents.push("down:${id}"); };`,
  );
  return dir;
}

fs.writeFileSync(outside, "export default () => {};");
plugin("base");
plugin("uses-base", { requires: ["base"] });
plugin("broken", { body: 'throw new Error("boom")' });
plugin("needs-broken", { requires: ["broken"] });
plugin("needs-needs-broken", { requires: ["needs-broken"] });
plugin("cyc-a", { requires: ["cyc-b"] });
plugin("cyc-b", { requires: ["cyc-a"] });
plugin("lost", { requires: ["nope"] });
plugin("ui-only", { entry: false });
const escaping = plugin("escaping");
fs.rmSync(path.join(escaping, "index.ts"));
fs.symlinkSync(outside, path.join(escaping, "index.ts")); // 폴더 밖 파일을 가리키는 심볼릭 링크

const loader = new PluginLoader();
const statuses = await loader.loadAll();
const by = (id: string) => statuses.find((s) => s.id === id)!;

test("의존하는 플러그인보다 먼저 올라오고, 내려갈 때는 역순이다", async () => {
  expect(by("base").state).toBe("active");
  expect(by("uses-base").state).toBe("active");
  expect(events.indexOf("up:base")).toBeLessThan(events.indexOf("up:uses-base"));
  await loader.unloadAll();
  expect(events.indexOf("down:uses-base")).toBeLessThan(events.indexOf("down:base"));
});

test("한 플러그인의 실패가 관계없는 플러그인을 막지 않는다", () => {
  expect(by("broken").state).toBe("failed");
  expect(by("broken").error).toBe("boom");
  expect(by("ui-only").state).toBe("active"); // entry 없는 UI 전용 플러그인
});

test("실패하거나 건너뛴 플러그인에 의존하는 플러그인은 올라오지 않는다 (연쇄)", () => {
  expect(by("needs-broken").state).toBe("skipped");
  expect(by("needs-broken").error).toContain('"broken" unavailable');
  expect(by("needs-needs-broken").state).toBe("skipped");
  expect(events).not.toContain("up:needs-broken");
});

test("순환 의존과 없는 의존은 건너뛴다", () => {
  expect(by("cyc-a").state).toBe("skipped");
  expect(by("cyc-b").state).toBe("skipped");
  expect(by("lost").state).toBe("skipped");
  expect(by("lost").error).toContain('"nope" not found');
});

test("entry가 플러그인 폴더 밖을 가리키면 거부한다", () => {
  expect(by("escaping").state).toBe("failed");
  expect(by("escaping").error).toContain("inside the plugin folder");
  expect(events).not.toContain("up:escaping");
});
