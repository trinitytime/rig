import { z } from "zod";

/** 플러그인 자신의 버전. 호스트 버전과는 무관하며, YYYY-MM-DD 형식이면서 실제로 있는 날짜(2026-02-30 같은 값은 거부). */
const dateVersion = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD format")
  .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "must be a real calendar date");

/** URL에 그대로 쓰는 플러그인 식별자. 영문자, 숫자, -, _ 만 허용한다. */
export const pluginIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "must be 1-64 chars of letters, digits, '-' or '_'");

/** 플러그인 폴더 안을 가리키는 상대경로. 절대경로와 `..`는 거부한다 (매니페스트는 외부 입력이다). */
const entrySchema = z
  .string()
  .min(1)
  .refine((p) => !/^([A-Za-z]:|[\\/])/.test(p) && !p.split(/[\\/]/).includes(".."), "must be a relative path inside the plugin folder");

const manifestSchema = z.object({
  id: pluginIdSchema,
  /** 표시용 이름. 자유롭게 쓸 수 있다. */
  name: z.string().min(1),
  version: dateVersion,
  /** 백엔드 엔트리 파일(.ts 또는 .js) 하나. manifest.json이 있는 폴더 기준 상대경로. UI 전용 플러그인은 생략한다. */
  entry: entrySchema.optional(),
  ui: z.object({ entry: z.string(), slot: z.string() }).optional(),
  /** 필요한 플러그인의 id 목록. */
  requires: z.array(pluginIdSchema).optional(),
  permissions: z.array(z.string()).optional(),
});

export type PluginManifest = z.infer<typeof manifestSchema>;

/** manifest.json 내용을 검증하고 PluginManifest로 변환한다. 잘못되면 Error를 던진다. */
export function parseManifest(raw: unknown): PluginManifest {
  const r = manifestSchema.safeParse(raw);
  if (!r.success) throw new Error(z.prettifyError(r.error));
  return r.data;
}
