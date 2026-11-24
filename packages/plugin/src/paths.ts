import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUp } from "find-up";

/** 저장소 루트: .monorepo 파일이 있는 가장 가까운 상위 폴더. src, tsc 출력, 번들 어디서 실행해도 같다. */
const monorepoMarker = await findUp(".monorepo", { cwd: path.dirname(fileURLToPath(import.meta.url)) });
if (!monorepoMarker) throw new Error(".monorepo not found: cannot locate the repository root");
export const REPO_ROOT = path.dirname(monorepoMarker);

/** 사용자 데이터 폴더. RIG_HOME > %APPDATA%/rig (Windows) > ~/.config/rig */
export function rigHome(): string {
  if (process.env.RIG_HOME) return path.resolve(process.env.RIG_HOME);
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, "rig");
  return path.join(os.homedir(), ".config", "rig");
}
