#!/usr/bin/env bun
// 사용법: copy-publish-files [패키지 경로] (기본값: 현재 디렉터리)
// <패키지>/package.json의 files 항목(하위 폴더 포함)과 LICENSE, README.md를 <패키지>/dist로 복사한다.
// LICENSE, README.md는 패키지 폴더에 없으면 상위 폴더에서 가장 가까운 것을 쓰고, 어디에도 없으면 건너뛴다.
import { cp, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { findUp } from 'find-up'

const packageDir = path.resolve(process.argv[2] ?? '.')
const outDir = path.join(packageDir, 'dist')
const pkg = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8')) as { files?: string[] }

await mkdir(outDir, { recursive: true })

// shortcut: files의 glob(`*`)과 `!` 제외 패턴은 지원하지 않는다, 필요해지면 glob 라이브러리로 올린다.
for (const entry of pkg.files ?? []) {
  const from = path.join(packageDir, entry)
  if (from === outDir) continue // dist 자신은 복사하지 않는다
  await cp(from, path.join(outDir, entry), { recursive: true }) // 없으면 오류: 잘못 적힌 항목을 알린다
}

const extras = [['LICENSE', 'LICENSE.md', 'LICENSE.txt'], ['README.md']]
for (const names of extras) {
  const found = await findUp(names, { cwd: packageDir })
  if (found) await cp(found, path.join(outDir, path.basename(found)))
}
