#!/usr/bin/env node
// 외부 의존성 없는 런처: node_modules가 없으면 npm install(workspaces: packages/* 전체) 후 node_modules에 설치된 bun으로 core를 구동한다.
import { existsSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
// .bin/bun.cmd 대신 실제 실행 파일을 쓴다: Windows에서 .cmd를 shell 없이 spawn하면 EINVAL이다 (모든 플랫폼에서 bun 패키지의 bin/bun.exe가 실제 바이너리다).
const bunBin = join(root, "node_modules", "bun", "bin", "bun.exe");

function run(cmd, args) {
  // Windows에서는 npm이 .cmd라서 npm만 shell이 필요하다 (경로에 공백이 있는 node는 shell을 거치면 깨진다).
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
  if (r.error) {
    console.error(r.error.code === "ENOENT" ? `${cmd}을(를) 찾을 수 없습니다. (bun은 core의 의존성으로 node_modules에 설치됩니다)` : r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 이미 떠 있는지 확인한다: 포트가 응답하고 /health가 rig면 중복 구동하지 않는다.
// (확인과 구동 사이의 경합은 막지 못한다. 마지막 방어선은 core의 포트 바인딩 실패다.)
async function checkRunning() {
  const port = Number(process.env.RIG_PORT ?? 7440); // core의 DEFAULT_PORT와 같은 값
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`RIG_PORT는 1~65535 사이의 정수여야 합니다 ("${process.env.RIG_PORT}").`);
    process.exit(1);
  }
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
    const body = await res.json().catch(() => null);
    if (body?.name === "rig") {
      console.log(`rig가 이미 실행 중입니다 (http://127.0.0.1:${port}).`);
      process.exit(0);
    }
    console.error(`포트 ${port}를 다른 프로그램이 사용 중입니다.`);
    process.exit(1);
  } catch (e) {
    if (e?.cause?.code === "ECONNREFUSED") return port; // 비어 있음
    console.error(`포트 ${port}를 확인하지 못했습니다 (${e?.cause?.code ?? e?.name ?? e}). 다른 프로그램이 사용 중일 수 있습니다.`);
    process.exit(1);
  }
}
const port = await checkRunning();

if (!existsSync(join(root, "node_modules"))) run("npm", ["install"]);
// ignore-scripts=true라 npm install만으로는 bin/bun.exe가 자리표시자(수 KB)로 남는다. 그대로 실행하면 Windows에서 spawn UNKNOWN이 되므로,
// 진짜 바이너리가 아니면 bun의 postinstall만 직접 실행한다 (node_modules가 이미 있어도 확인한다).
const isPlaceholder = () => !existsSync(bunBin) || statSync(bunBin).size < 1_000_000;
if (isPlaceholder()) {
  run(process.execPath, [join(root, "node_modules", "bun", "install.js")]);
  if (isPlaceholder()) {
    console.error("bun 바이너리를 준비하지 못했습니다. 네트워크를 확인하고 다시 실행하세요.");
    process.exit(1);
  }
}

// bun은 구동만 맡는다(--no-install: 자동 설치 끔). 설치는 위의 npm install이 한다.
// core를 런처와 분리해서 띄우고, /health가 응답하면 런처는 종료한다.
// shortcut: core의 출력은 버려진다(stdio ignore), 로그 파일이 필요해지면 파일로 연결.
const core = spawn(bunBin, ["--no-install", join(root, "packages/core/src/main.ts"), ...process.argv.slice(2)], { cwd: root, stdio: "ignore", detached: true, windowsHide: true });
let exited = null;
core.on("error", (e) => (exited = e.code === "ENOENT" ? "bun을 찾을 수 없습니다. (bun은 core의 의존성으로 node_modules에 설치됩니다)" : e.message));
core.on("exit", (code) => (exited = `core가 종료되었습니다 (code ${code})`));

for (let i = 0; i < 75 && !exited; i++) {
  const ok = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) })
    .then((r) => r.json())
    .then((b) => b?.name === "rig", () => false);
  if (ok) {
    console.log(`rig가 구동되었습니다 (http://127.0.0.1:${port}, pid ${core.pid}).`);
    core.unref();
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 200));
}
console.error(exited ?? "core가 15초 안에 응답하지 않았습니다.");
core.kill();
process.exit(1);
