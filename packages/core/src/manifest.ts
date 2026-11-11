import { z } from "zod";

export const RIG_API_VERSION = 1;

/** URL에 그대로 쓰는 플러그인 식별자. 영문자, 숫자, -, _ 만 허용한다. */
export const pluginIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "must be 1-64 chars of letters, digits, '-' or '_'");

const manifestSchema = z.object({
  id: pluginIdSchema,
  /** 표시용 이름. 자유롭게 쓸 수 있다. */
  name: z.string().min(1),
  apiVersion: z.literal(RIG_API_VERSION, { error: `unsupported apiVersion (host supports ${RIG_API_VERSION})` }),
  /** 백엔드 엔트리. 플러그인의 빌드 출력 폴더 기준 상대경로. */
  backend: z.string().optional(),
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
