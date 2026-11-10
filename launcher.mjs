#!/usr/bin/env node
// 외부 의존성 없는 런처: node_modules가 없으면 npm install(workspaces: packages/* 전체) 후 bun으로 core를 구동한다.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function run(cmd, args) {
  // Windows에서는 npm이 .cmd라서 shell이 필요하다.
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) {
    console.error(r.error.code === "ENOENT" ? `${cmd}을(를) 찾을 수 없습니다.` : r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(join(root, "node_modules"))) run("npm", ["install"]);
run("bun", [join(root, "packages/core/src/main.ts"), ...process.argv.slice(2)]);
