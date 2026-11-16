// 각 패키지의 build:type이 dist/types/<이름>/ 에 낸 .d.ts를 하나의 타입 패키지(@rig/types)로 묶는다: dist/types/package.json을 쓴다.
// 다른 프로젝트에서는 필요한 모듈만 import한다 (예: import type { RigPlugin } from '@rig/types/core').
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const types = join(root, 'dist/types')
// 하위 경로 이름 → 그 폴더의 진입 파일
const entries = { core: 'plugin', systray: 'types', dashboard: 'types' }

const exports = {}
for (const [name, file] of Object.entries(entries)) {
  const rel = `./${name}/${file}.d.ts`
  if (!existsSync(join(types, rel))) throw new Error(`${rel} not found: run build:type of the "${name}" package first`)
  exports[`./${name}`] = { types: rel }
}
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const pkg = { name: '@rig/types', version, description: 'Rig type declarations (core, systray, dashboard)', type: 'module', exports }
writeFileSync(join(types, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
