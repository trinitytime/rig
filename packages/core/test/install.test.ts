import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addFromArchive, addFromPath, addPlugin } from "../src/plugin/install.ts";
import { loadInstalled } from "../src/plugin/registry.ts";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "rig-install-"));
process.env.RIG_HOME = home;
afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

const config = {};
// 운영 의존성(로컬 패키지)과, 게시되지 않아 설치하면 실패하는 dev/peer 의존성을 가진 플러그인 폴더.
const depSrc = path.join(fs.mkdtempSync(path.join(home, "dep-")), "package");
fs.mkdirSync(depSrc);
fs.writeFileSync(path.join(depSrc, "package.json"), JSON.stringify({ name: "local-dep", version: "1.0.0" }));
const dep = path.join(home, "local-dep.tgz"); // tarball 의존성은 레지스트리 패키지처럼 node_modules에 실제로 복사된다
execFileSync("tar", ["-czf", dep, "-C", path.dirname(depSrc), "package"]);
function makePlugin(id: string) {
  const dir = fs.mkdtempSync(path.join(home, `src-${id}-`));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      name: id,
      version: "1.0.0",
      dependencies: { "local-dep": `file:${dep}` },
      devDependencies: { "@rig/core": "*" },
      peerDependencies: { "@rig/core": "*" },
      rig: { id, displayName: id, entry: "index.ts" },
    }),
  );
  fs.writeFileSync(path.join(dir, "index.ts"), "export default () => {};");
  return dir;
}

test("경로의 플러그인은 설치 목록에 꺼진 custom으로 추가되고, 중복과 잘못된 입력은 거부한다", async () => {
  const dir = makePlugin("by-path");
  const before = fs.readFileSync(path.join(dir, "package.json"), "utf8");
  const m = await addFromPath(config, dir);
  expect(m.id).toBe("by-path");
  expect(fs.existsSync(path.join(dir, "node_modules", "local-dep", "package.json"))).toBe(true); // 운영 의존성만 설치
  expect(fs.readFileSync(path.join(dir, "package.json"), "utf8")).toBe(before); // 사용자 폴더의 package.json은 그대로
  expect(fs.existsSync(path.join(dir, "package-lock.json"))).toBe(false);
  expect(loadInstalled(config)).toContainEqual({ id: "by-path", source: "custom", enabled: false, path: dir });
  await expect(addFromPath(config, dir)).rejects.toThrow("already installed");
  await expect(addFromPath(config, "relative/dir")).rejects.toThrow("absolute");
  await expect(addFromPath(config, path.join(home, "nope"))).rejects.toThrow("package.json not found");
  const plain = fs.mkdtempSync(path.join(home, "plain-"));
  fs.writeFileSync(path.join(plain, "package.json"), JSON.stringify({ name: "x", version: "1.0.0" }));
  await expect(addFromPath(config, plain)).rejects.toThrow("no \"rig\" field");
});

test("압축 파일은 설치 경로에 풀리고 설치 목록에 꺼진 user로 추가된다 (npm pack처럼 package/ 폴더도 허용)", async () => {
  const dir = makePlugin("by-archive");
  const tgz = path.join(home, "by-archive.tgz");
  // npm pack의 tarball처럼 맨 위가 package/ 폴더가 되게 만든다.
  fs.mkdirSync(path.join(home, "stage"));
  fs.renameSync(dir, path.join(home, "stage", "package"));
  execFileSync("tar", ["-czf", tgz, "-C", path.join(home, "stage"), "package"]);
  const m = await addFromArchive(config, tgz);
  expect(m.id).toBe("by-archive");
  expect(fs.existsSync(path.join(home, "plugins", "node_modules", "by-archive", "index.ts"))).toBe(true);
  expect(fs.existsSync(path.join(home, "plugins", "node_modules", "by-archive", "node_modules", "local-dep"))).toBe(true);
  expect(loadInstalled(config)).toContainEqual({ id: "by-archive", source: "user", enabled: false });
  expect(fs.readdirSync(path.join(home, "plugins")).filter((n) => n.startsWith(".extract-"))).toEqual([]); // 임시 폴더 정리
  await expect(addFromArchive(config, tgz)).rejects.toThrow("already installed");
  expect(fs.existsSync(path.join(home, "plugins", "node_modules", "by-archive"))).toBe(true); // 실패해도 기존 폴더는 그대로
  await expect(addFromArchive(config, path.join(home, "none.tgz"))).rejects.toThrow("not found");
});

test("addPlugin은 폴더면 그 자리에서, 파일이면 압축 파일로 설치한다", async () => {
  const dir = makePlugin("any-dir");
  expect((await addPlugin(config, dir)).id).toBe("any-dir");
  expect(loadInstalled(config)).toContainEqual({ id: "any-dir", source: "custom", enabled: false, path: dir });
  const stage = fs.mkdtempSync(path.join(home, "stage-any-"));
  fs.renameSync(makePlugin("any-file"), path.join(stage, "package"));
  const tgz = path.join(home, "any-file.tgz");
  execFileSync("tar", ["-czf", tgz, "-C", stage, "package"]);
  expect((await addPlugin(config, tgz)).id).toBe("any-file");
  expect(loadInstalled(config)).toContainEqual({ id: "any-file", source: "user", enabled: false });
  await expect(addPlugin(config, path.join(home, "missing"))).rejects.toThrow("not found");
  await expect(addPlugin(config, "rel/x")).rejects.toThrow("absolute");
});
