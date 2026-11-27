// 사용법: bun scripts/publish.ts [--dry-run]
// packages/*/dist(빌드 결과)를 배포한다. 레지스트리에 같은 버전이 이미 있으면 건너뛰고, 의존하는 패키지를 먼저 배포한다.
import { $, Glob } from 'bun'

type Pkg = Record<string, Record<string, string> | string | boolean | undefined>
type Item = { dir: string; name: string; version: string; deps: string[] }

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']
const dryRun = process.argv.includes('--dry-run')

function depNames(pkg: Pkg) {
  return DEP_FIELDS.flatMap((field) => Object.keys((pkg[field] as Record<string, string> | undefined) ?? {}))
}

/** 의존하는 패키지가 앞에 오도록 정렬한다. */
function sortByDeps(items: Item[]) {
  const byName = new Map(items.map((item) => [item.name, item]))
  const seen = new Set<string>()
  const sorted: Item[] = []
  const visit = (item: Item) => {
    if (seen.has(item.name)) return
    seen.add(item.name)
    for (const dep of item.deps) if (byName.has(dep)) visit(byName.get(dep)!)
    sorted.push(item)
  }
  items.forEach(visit)
  return sorted
}

// private이거나 dist가 없는 패키지(launcher 등)는 배포 대상이 아니다.
const items: Item[] = []
for await (const file of new Glob('packages/*/package.json').scan('.')) {
  const dir = file.replace('/package.json', '')
  const distFile = Bun.file(`${dir}/dist/package.json`)
  if ((await Bun.file(file).json()).private || !(await distFile.exists())) continue
  const dist = (await distFile.json()) as Pkg
  items.push({ dir, name: dist.name as string, version: dist.version as string, deps: depNames(dist) })
}

for (const { dir, name, version } of sortByDeps(items)) {
  const found = await $`npm view ${name}@${version} version`.nothrow().quiet()
  if (found.text().trim()) {
    console.log(`skip ${name}@${version} (already published)`)
    continue
  }
  console.log(`publish ${name}@${version}${dryRun ? ' (dry-run)' : ''}`)
  const target = `${dir}/dist`
  const flags = dryRun ? ['--dry-run'] : []
  await $`npm publish ${target} --access public ${flags}` // 실패하면 예외가 나서 멈춘다
}
