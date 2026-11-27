#!/usr/bin/env node
// 사용법: rig-build [작업 이름...] (없으면 build.config.ts의 모든 작업을 정의된 순서대로 실행)
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Job } from './index.ts'

try {
  const jobs = (await import(pathToFileURL(path.resolve('build.config.ts')).href)).default as Record<string, Job>
  const names = process.argv.slice(2)
  const targets = names.length ? names : Object.keys(jobs)
  const unknown = targets.filter((name) => !jobs[name])
  if (unknown.length) throw new Error(`unknown job: ${unknown.join(', ')}`)
  for (const name of targets) {
    console.log(`> ${name}`)
    await jobs[name]!()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
