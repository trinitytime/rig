import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 저장소 루트. 실행 위치(cwd)가 아니라 이 파일 위치(<root>/dist/core/)로 계산한다. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** 사용자 데이터 폴더. RIG_HOME > %APPDATA%/rig (Windows) > ~/.config/rig */
export function rigHome(): string {
  if (process.env.RIG_HOME) return path.resolve(process.env.RIG_HOME);
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, "rig");
  return path.join(os.homedir(), ".config", "rig");
}
