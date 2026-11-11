import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 저장소 루트: 이 파일에서 위로 올라가며 packages/ 와 package.json 이 있는 첫 폴더.
 * 소스(packages/core/src), tsc 출력(dist/core), 단일 번들(dist/rig.js) 어디서 실행해도 같은 값이 나온다.
 */
function findRepoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (fs.existsSync(path.join(dir, "packages")) && fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("cannot locate the repository root");
    dir = parent;
  }
}
export const REPO_ROOT = findRepoRoot();

/** 사용자 데이터 폴더. RIG_HOME > %APPDATA%/rig (Windows) > ~/.config/rig */
export function rigHome(): string {
  if (process.env.RIG_HOME) return path.resolve(process.env.RIG_HOME);
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, "rig");
  return path.join(os.homedir(), ".config", "rig");
}
