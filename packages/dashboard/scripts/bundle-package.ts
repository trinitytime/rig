// 이 패키지를 번들하고 package.json과 런타임 파일을 만들어 dist/rig-works/<패키지 경로>에 함께 둔다.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { findUp } from 'find-up'
import { omit, merge } from 'es-toolkit'

const monorepoMarker = await findUp('.monorepo', { cwd: import.meta.dirname }) // 파일 경로를 돌려준다
if (!monorepoMarker) throw new Error('.monorepo not found: cannot locate the repository root')

const root = path.dirname(monorepoMarker)

const packageJsonPath = await findUp('package.json', { cwd: import.meta.dirname }) // 이 파일 기준 가장 가까운 package.json
if (!packageJsonPath) throw new Error('package.json not found: cannot locate the package')
const packageDir = path.dirname(packageJsonPath)
const outDir = path.join(root, 'dist/rig-works', path.relative(root, packageDir)) // root 기준 패키지 경로를 그대로 따른다

/** bun build --target bun --packages external --outdir <outDir> src/index.ts --entry-naming index.js */
async function bundle() {
  const result = await Bun.build({
    entrypoints: [path.join(packageDir, 'src/index.ts')],
    outdir: outDir,
    target: 'bun',
    packages: 'external',
    naming: 'index.js',
  })
  if (!result.success) throw new AggregateError(result.logs, 'bundle failed')
}

/** 패키지의 package.json에서 devDependencies를 빼고 main, rig.entry를 index.js로 해 outDir/package.json으로 쓴다. */
async function writePackageJson() {
  const pkg = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'))
  const out = merge(omit(pkg, ['devDependencies']), { main: 'index.js', rig: { entry: 'index.js' } })
  await mkdir(outDir, { recursive: true }) // 번들과 동시에 실행되므로 폴더를 직접 보장한다
  await writeFile(path.join(outDir, 'package.json'), JSON.stringify(out, null, 2) + '\n')
}

/** dashboard가 번들 옆에서 읽는 rig-ui.css, client.js를 복사한다. */
async function copyFiles() {
  await Promise.all([['src/rig-ui.css', 'rig-ui.css'], ['src/client.js', 'client.js']].map(([from, to]) => cp(path.join(packageDir, from), path.join(outDir, to), { recursive: true })))
}

await Promise.all([bundle(), writePackageJson(), copyFiles()])
