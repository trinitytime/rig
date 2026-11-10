#!/usr/bin/env node
// 외부 의존성 없는 런처: node_modules가 없으면 bun install 후 bun으로 core를 구동한다.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function bun(args) {
  const r = spawnSync("bun", args, { cwd: root, stdio: "inherit" });
  if (r.error) {
    console.error(r.error.code === "ENOENT" ? "bun을 찾을 수 없습니다. https://bun.sh 에서 설치하세요." : r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(join(root, "node_modules"))) bun(["install"]);
bun([join(root, "packages/core/src/main.ts"), ...process.argv.slice(2)]);
