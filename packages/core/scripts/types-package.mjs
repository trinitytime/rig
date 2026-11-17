// 각 패키지의 build:type이 dist/types/<이름>/ 에 낸 .d.ts를 하나의 타입 패키지(@rig-works/types)로 묶는다: dist/types/package.json을 쓴다.
// 다른 프로젝트에서는 필요한 모듈만 import하거나 (import type { RigPlugin } from '@rig-works/types/core'), 전부 한 번에 import한다 (from '@rig-works/types').
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const types = join(root, 'dist/types')
// 하위 경로 이름 → 그 폴더의 진입 파일
const entries = { core: 'plugin', systray: 'types', dashboard: 'types' }

const exports = { '.': { types: './index.d.ts' } }
let index = ''
for (const [name, file] of Object.entries(entries)) {
  const rel = `./${name}/${file}.d.ts`
  if (!existsSync(join(types, rel))) throw new Error(`${rel} not found: run build:type of the "${name}" package first`)
  exports[`./${name}`] = { types: rel }
  index += `export * from './${name}/${file}.js'\n`
}
writeFileSync(join(types, 'index.d.ts'), index) // 이름이 겹치면 이 파일에서 오류가 난다
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const pkg = { name: '@rig-works/types', version, description: 'Rig type declarations (core, systray, dashboard)', type: 'module', exports }
writeFileSync(join(types, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
