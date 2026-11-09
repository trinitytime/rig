export const RIG_API_VERSION = 1;

export interface PluginManifest {
  name: string;
  apiVersion: number;
  /** 백엔드 엔트리. 플러그인의 빌드 출력 폴더 기준 상대경로. */
  backend?: string;
  ui?: { entry: string; slot: string };
  requires?: string[];
  permissions?: string[];
}

const isStrArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/** manifest.json 내용을 검증하고 PluginManifest로 변환한다. 잘못되면 Error를 던진다. */
export function parseManifest(raw: unknown): PluginManifest {
  if (typeof raw !== "object" || raw === null) throw new Error("manifest must be an object");
  const m = raw as Record<string, unknown>;
  if (typeof m.name !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(m.name))
    throw new Error('"name" must be a lowercase string like "browser"');
  if (m.apiVersion !== RIG_API_VERSION)
    throw new Error(`unsupported apiVersion ${String(m.apiVersion)} (host supports ${RIG_API_VERSION})`);
  if (m.backend !== undefined && typeof m.backend !== "string") throw new Error('"backend" must be a string');
  if (m.requires !== undefined && !isStrArray(m.requires)) throw new Error('"requires" must be string[]');
  if (m.permissions !== undefined && !isStrArray(m.permissions)) throw new Error('"permissions" must be string[]');
  if (m.ui !== undefined) {
    const ui = m.ui as Record<string, unknown>;
    if (typeof ui?.entry !== "string" || typeof ui?.slot !== "string")
      throw new Error('"ui" must be { entry: string, slot: string }');
  }
  return m as unknown as PluginManifest;
}
