// 사용법: bun run scripts/write-publish-package.ts <패키지 경로>
// <패키지>/package.json 위에 <패키지>/package.publish.json을 덮어써 <패키지>/dist/package.json을 만든다.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// shortcut: 최상위 키만 덮어쓴다(중첩 객체는 통째로 교체), 필드별 병합이 필요해지면 깊은 병합으로 올린다.
/** 값이 null인 키는 지우고, 나머지는 덮어쓰거나 추가한다. */
function applyOverrides(base: Record<string, unknown>, overrides: Record<string, unknown>) {
  const merged = { ...base, ...overrides }
  for (const key of Object.keys(merged)) if (merged[key] === null) delete merged[key]
  return merged
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
}

const packageDir = path.resolve(process.argv[2] ?? '.')
const pkg = await readJson(path.join(packageDir, 'package.json'))
const overrides = await readJson(path.join(packageDir, 'package.publish.json'))

const outDir = path.join(packageDir, 'dist')
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'package.json'), JSON.stringify(applyOverrides(pkg, overrides), null, 2) + '\n')
