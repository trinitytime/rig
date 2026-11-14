import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { Config } from '../config.ts'
import { rigHome } from '../paths.ts'
import { discoverPlugins } from './discovery.ts'
import { pluginIdSchema } from './manifest.ts'

/**
 * 설치된 플러그인 한 건. 위치(source)에 따라 폴더를 찾는 방법이 다르다:
 *  - builtin: 코어와 함께 있는 플러그인 (<repo>/packages/*). 폴더는 id로 찾으므로 경로를 저장하지 않는다.
 *  - user:    rig 데이터 폴더에 설치한 플러그인 (<RIG_HOME>/plugins/node_modules/*). 역시 id로 찾는다.
 *  - custom:  사용자가 입력한 임의 위치의 플러그인. 폴더를 알 수 없으므로 절대경로(path)를 저장한다.
 */
const base = { id: pluginIdSchema, /** 켜져 있으면 로드한다. */ enabled: z.boolean() }

const installedPluginSchema = z.discriminatedUnion('source', [
  z.object({ ...base, source: z.literal('builtin') }),
  z.object({ ...base, source: z.literal('user') }),
  z.object({
    ...base,
    source: z.literal('custom'),
    /** manifest.json이 있는 폴더의 절대경로 */ path: z.string().min(1),
  }),
])

/** 설치된 모든 플러그인 목록 (id 중복 없음은 저장할 때 보장한다). */
export const installedPluginsSchema = z.array(installedPluginSchema)

export type InstalledPlugin = z.infer<typeof installedPluginSchema>
export type InstalledPlugins = z.infer<typeof installedPluginsSchema>

/** 설치된 플러그인 목록 파일: core 플러그인의 데이터 폴더(<RIG_HOME>/data/core)에 둔다. */
const installedFile = () => path.join(rigHome(), 'data', 'core', 'installed-plugins.json')

/**
 * 목록 파일이 있으면 그것만 읽고 설정 파일의 plugins는 무시한다.
 * 없으면 플러그인을 탐색해 목록을 만들고(활성 여부는 설정 파일의 plugins, 적혀 있지 않으면 활성) 파일로 저장한다.
 */
export function loadInstalled(config: Config): InstalledPlugins {
  const file = installedFile()
  if (fs.existsSync(file)) {
    try {
      return installedPluginsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch (e) {
      throw new Error(`invalid ${file}: ${e instanceof Error ? e.message : e}`)
    }
  }
  const list: InstalledPlugins = discoverPlugins().plugins.flatMap((p) =>
    p.source === 'custom' ? [] : [{ id: p.manifest.id, source: p.source, enabled: config.plugins?.[p.manifest.id] ?? true }],
  )
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(list, null, 2))
  return list
}
