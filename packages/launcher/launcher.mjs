#!/usr/bin/env node
// 외부 의존성 없는 런처: node_modules가 없으면 npm install(workspaces: packages/* 전체) 후 node_modules에 설치된 bun으로 core를 구동한다.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bunBin = join(root, "node_modules", ".bin", process.platform === "win32" ? "bun.cmd" : "bun");

function run(cmd, args) {
  // Windows에서는 npm이 .cmd라서 shell이 필요하다.
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) {
    console.error(r.error.code === "ENOENT" ? `${cmd}을(를) 찾을 수 없습니다. (bun은 core의 의존성으로 node_modules에 설치됩니다)` : r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(join(root, "node_modules"))) {
  run("npm", ["install"]);
  // ignore-scripts=true인 환경에서도 bun 바이너리가 준비되도록 bun의 postinstall만 직접 실행한다.
  run(process.execPath, [join(root, "node_modules", "bun", "install.js")]);
}
run(bunBin, [join(root, "packages/core/src/main.ts"), ...process.argv.slice(2)]);
