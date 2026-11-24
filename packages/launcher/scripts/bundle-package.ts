// launcher.mjs를 dist/rig-works/<패키지 경로>에 복사한다.
import { cp } from 'node:fs/promises'
import path from 'node:path'
import { findUp } from 'find-up'

const monorepoMarker = await findUp('.monorepo', { cwd: import.meta.dirname }) // 파일 경로를 돌려준다
if (!monorepoMarker) throw new Error('.monorepo not found: cannot locate the repository root')

const root = path.dirname(monorepoMarker)

const packageJsonPath = await findUp('package.json', { cwd: import.meta.dirname }) // 이 파일 기준 가장 가까운 package.json
if (!packageJsonPath) throw new Error('package.json not found: cannot locate the package')
const packageDir = path.dirname(packageJsonPath)
const outDir = path.join(root, 'dist/rig-works', path.relative(root, packageDir)) // root 기준 패키지 경로를 그대로 따른다

await Promise.all([
  cp(path.join(packageDir, 'launcher.mjs'), path.join(outDir, 'launcher.mjs')),
  cp(path.join(root, 'rig.vbs'), path.join(root, 'dist/rig-works', 'rig.vbs')),
])
