// 이 패키지를 번들하고 package.json과 런타임 파일을 만들어 dist/<패키지 이름>에 함께 둔다. 타입(.d.ts)은 outDir/types에 만든다.
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
const packageName = path.basename(packageDir)
const outDir = path.join(root, 'dist', packageName) // root 기준 패키지 경로를 그대로 따른다

/** bun build --target bun --packages external --outdir <outDir> src/index.ts --entry-naming index.js --minify */
async function bundle() {
  const result = await Bun.build({
    entrypoints: [path.join(packageDir, 'src/index.ts')],
    outdir: outDir,
    target: 'bun',
    packages: 'external',
    naming: 'index.js',
    minify: true,
  })
  if (!result.success) throw new AggregateError(result.logs, 'bundle failed')
}

/** 패키지 tsconfig.json대로 .d.ts만 outDir/types에 만든다. tsc는 bun run이 PATH에 올려 둔다. */
async function emitTypes() {
  const tsconfigPath = path.join(packageDir, 'tsconfig.json')
  const outPath = path.join(outDir, 'types')
  // 참조한 plugin의 .d.ts가 먼저 있어야 systray 타입에 plugin 소스가 섞이지 않는다
  const built = await Bun.$`tsc -b ${path.join(packageDir, '../plugin')} --emitDeclarationOnly --force`.nothrow()
  if (built.exitCode) throw new Error(`plugin type emit failed (tsc exit ${built.exitCode})`)
  const opts = ['--emitDeclarationOnly', '--composite', 'false', '--incremental', 'false'] // 문자열 하나로 넣으면 인자 하나로 전달된다
  const { exitCode } = await Bun.$`tsc -p ${tsconfigPath} --outDir ${outPath} ${opts}`.nothrow()
  if (exitCode) throw new Error(`type emit failed (tsc exit ${exitCode})`)
}

/** 패키지의 package.json에서 devDependencies를 빼고 main, types, rig.entry를 넣어 outDir/package.json으로 쓴다. */
async function writePackageJson() {
  const pkg = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'))
  const out = merge(omit(pkg, ['devDependencies']), {
    main: 'index.js',
    types: 'types/index.d.ts',
    rig: { entry: 'index.js' },
  })
  await mkdir(outDir, { recursive: true }) // 번들과 동시에 실행되므로 폴더를 직접 보장한다
  await writeFile(path.join(outDir, 'package.json'), JSON.stringify(out, null, 2) + '\n')
}

/** 트레이 아이콘이 든 assets 폴더를 복사한다. */
async function copyFiles() {
  await Promise.all(
    [['assets', 'assets']].map(([from, to]) =>
      cp(path.join(packageDir, from), path.join(outDir, to), { recursive: true }),
    ),
  )
}

await Promise.all([bundle(), emitTypes(), writePackageJson(), copyFiles()])
