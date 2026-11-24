import { z } from 'zod'

/** semver.org의 공식 정규식. npm 배포 버전과 같은 규칙이다. */
const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

/** URL에 그대로 쓰는 플러그인 식별자. 영문자, 숫자, -, _ 만 허용한다. */
export const pluginIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "must be 1-64 chars of letters, digits, '-' or '_'")

/** 플러그인 폴더 안을 가리키는 상대경로. 절대경로와 `..`는 거부한다 (매니페스트는 외부 입력이다). */
const entrySchema = z
  .string()
  .min(1)
  .refine(
    (p) => !/^([A-Za-z]:|[\\/])/.test(p) && !p.split(/[\\/]/).includes('..'),
    'must be a relative path inside the plugin folder',
  )

/** package.json의 rig 항목: rig가 플러그인을 다루는 데 필요한 정보만 둔다. */
const rigSchema = z.object({
  id: pluginIdSchema,
  /** 표시용 이름. 자유롭게 쓸 수 있다. */
  displayName: z.string().min(1),
  /** 백엔드 엔트리 파일(.ts 또는 .js) 하나. package.json이 있는 폴더 기준 상대경로. UI 전용 플러그인은 생략한다. */
  entry: entrySchema.optional(),
  ui: z.object({ entry: z.string(), slot: z.string() }).optional(),
  /** 필요한 플러그인의 id 목록. */
  requires: z.array(pluginIdSchema).optional(),
})

// shortcut: author/repository는 npm이 허용하는 문자열·객체 형태를 검증 없이 그대로 보관, 화면에 표시할 때 정규화
const manifestSchema = z.object({
  /** 플러그인 자신의 버전 (semver). 호스트 버전과는 무관하다. */
  version: z.string().regex(semver, 'must be a semver version (e.g. 1.0.0)'),
  description: z.string().optional(),
  author: z.union([z.string(), z.looseObject({ name: z.string() })]).optional(),
  repository: z.union([z.string(), z.looseObject({ url: z.string() })]).optional(),
  rig: rigSchema,
})

export type PluginManifest = Omit<z.infer<typeof manifestSchema>, 'rig'> &
  Omit<z.infer<typeof rigSchema>, 'displayName'> & { name: string }

/** package.json 내용을 검증하고 PluginManifest로 변환한다. 잘못되면 Error를 던진다. */
export function parseManifest(raw: unknown): PluginManifest {
  const r = manifestSchema.safeParse(raw)
  if (!r.success) throw new Error(z.prettifyError(r.error))
  const { rig, ...pkg } = r.data
  const { displayName, ...rest } = rig
  return { ...pkg, ...rest, name: displayName }
}
