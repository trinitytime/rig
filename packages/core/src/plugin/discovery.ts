import fs from "node:fs";
import path from "node:path";
import { parseManifest, type PluginManifest } from "./manifest.ts";
import { REPO_ROOT, rigHome } from "../paths.ts";

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  /** manifest.json이 있는 폴더 */
  dir: string;
  /** 백엔드 엔트리의 절대경로 (없으면 undefined) */
  entry?: string;
  source: "builtin" | "user";
}

export interface DiscoveryError {
  dir: string;
  error: string;
}

function readManifest(dir: string): PluginManifest {
  return parseManifest(JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")));
}

function subdirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() || d.isSymbolicLink())
    .flatMap((d) => {
      const p = path.join(dir, d.name);
      // @scope/name 형태 처리
      return d.name.startsWith("@") ? subdirs(p) : [p];
    });
}

/**
 * 플러그인 탐색 (우선순위 순, 같은 name이면 먼저 발견된 것이 우선):
 *  1. <repo>/packages/* — 내장. 백엔드는 <repo>/dist/<폴더>/<backend>
 *  2. <RIG_HOME>/plugins/node_modules/* — npm으로 설치한 플러그인. 백엔드는 패키지 폴더 기준
 */
export function discoverPlugins(): { plugins: DiscoveredPlugin[]; errors: DiscoveryError[] } {
  const plugins: DiscoveredPlugin[] = [];
  const errors: DiscoveryError[] = [];
  const seen = new Set<string>();

  const add = (dir: string, source: DiscoveredPlugin["source"], outDir: string) => {
    if (!fs.existsSync(path.join(dir, "manifest.json"))) return;
    try {
      const manifest = readManifest(dir);
      if (seen.has(manifest.id)) {
        errors.push({ dir, error: `duplicate plugin id "${manifest.id}" (ignored)` });
        return;
      }
      seen.add(manifest.id);
      const entry = manifest.backend ? path.resolve(outDir, manifest.backend) : undefined;
      plugins.push({ manifest, dir, entry, source });
    } catch (e) {
      errors.push({ dir, error: e instanceof Error ? e.message : String(e) });
    }
  };

  for (const dir of subdirs(path.join(REPO_ROOT, "packages")))
    add(dir, "builtin", path.join(REPO_ROOT, "dist", path.basename(dir)));

  for (const dir of subdirs(path.join(rigHome(), "plugins", "node_modules"))) add(dir, "user", dir);

  return { plugins, errors };
}
