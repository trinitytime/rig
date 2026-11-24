import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extract, extractCommand } from "../src/plugin/extract.ts";

test("zip은 Windows는 파워셸(경로는 환경 변수), Linux는 unzip, macOS는 tar, 그 외 형식은 tar로 푼다", () => {
  const win = extractCommand("C:\\a b\\p's.ZIP", "C:\\dest", "win32");
  expect(win.cmd).toBe("powershell.exe");
  expect(win.args.at(-1)).toContain("Expand-Archive");
  expect(win.args.join(" ")).not.toContain("a b"); // 경로는 명령 문자열에 섞지 않는다
  expect(win.env).toEqual({ RIG_ARCHIVE: "C:\\a b\\p's.ZIP", RIG_DEST: "C:\\dest" });
  expect(extractCommand("/a/p.zip", "/d", "linux")).toEqual({ cmd: "unzip", args: ["-q", "/a/p.zip", "-d", "/d"] });
  expect(extractCommand("/a/p.zip", "/d", "darwin")).toEqual({ cmd: "tar", args: ["-xf", "/a/p.zip", "-C", "/d"] });
  expect(extractCommand("/a/p.tgz", "/d", "linux")).toEqual({ cmd: "tar", args: ["-xf", "/a/p.tgz", "-C", "/d"] });
  expect(extractCommand("C:\\a\\p.tgz", "C:\\d", "win32").cmd).toEndWith("System32\\tar.exe");
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rig-extract-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

test("tgz는 실제로 푼다", async () => {
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.txt"), "hi");
  execFileSync("tar", ["-czf", path.join(dir, "a.tgz"), "-C", dir, "src"]);
  fs.mkdirSync(path.join(dir, "out1"));
  await extract(path.join(dir, "a.tgz"), path.join(dir, "out1"));
  expect(fs.readFileSync(path.join(dir, "out1", "src", "a.txt"), "utf8")).toBe("hi");
});

// zip은 이 환경의 python3와 unzip이 있을 때만 확인한다 (Linux 경로).
const hasZipTools = process.platform === "linux" && Bun.which("python3") && Bun.which("unzip");
test.skipIf(!hasZipTools)("Linux에서 zip을 unzip으로 푼다", async () => {
  execFileSync("python3", ["-m", "zipfile", "-c", "a.zip", "src"], { cwd: dir });
  fs.mkdirSync(path.join(dir, "out2"));
  await extract(path.join(dir, "a.zip"), path.join(dir, "out2"));
  expect(fs.existsSync(path.join(dir, "out2", "src", "a.txt"))).toBe(true);
  await expect(extract(path.join(dir, "missing.zip"), path.join(dir, "out2"))).rejects.toThrow("unzip");
});
