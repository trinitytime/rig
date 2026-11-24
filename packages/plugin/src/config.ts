import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { pluginIdSchema } from './plugin/manifest.ts'

/** 설정 파일. port의 범위 검사는 resolvePort가 한다. plugins는 설치 목록이 처음 만들어질 때만 쓰인다. */
const configSchema = z.object({
  port: z.number().optional(),
  plugins: z.record(pluginIdSchema, z.boolean()).optional(),
})
export type Config = z.infer<typeof configSchema>

/** 현재 폴더의 config.json을 읽는다 (처음 실행에는 RIG_HOME이 아직 없다). 파일이 없으면 빈 설정이고, 내용이 잘못되면 던진다. */
export function readConfig(): Config {
  const file = path.join(process.cwd(), 'config.json')
  if (!fs.existsSync(file)) return {}
  try {
    return configSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch (e) {
    throw new Error(`invalid ${file}: ${e instanceof Error ? e.message : e}`)
  }
}
