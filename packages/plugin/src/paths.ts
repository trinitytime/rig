import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUp } from "find-up";

/** 저장소 루트: workspaces 필드가 있는 가장 가까운 상위 package.json의 폴더. src, tsc 출력, 번들 어디서 실행해도 같다. */
const workspacePackageJson = await findUp(
  async (dir) => {
    const file = path.join(dir, "package.json");
    try {
      return JSON.parse(await readFile(file, "utf8")).workspaces ? file : undefined;
    } catch {
      return undefined; // package.json이 없거나 깨졌으면 다음 상위로
    }
  },
  { cwd: path.dirname(fileURLToPath(import.meta.url)) },
);
if (!workspacePackageJson) throw new Error("cannot locate the repository root");
export const REPO_ROOT = path.dirname(workspacePackageJson);

/** 사용자 데이터 폴더. RIG_HOME > %APPDATA%/rig (Windows) > ~/.config/rig */
export function rigHome(): string {
  if (process.env.RIG_HOME) return path.resolve(process.env.RIG_HOME);
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, "rig");
  return path.join(os.homedir(), ".config", "rig");
}
