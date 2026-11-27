import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Glob } from 'bun'

// shortcut: ctx를 Record<string, unknown>으로만 다룬다(변수 타입 검사 없음), 변수가 늘어 오타가 잦아지면 job 제네릭으로 올린다.
export type Ctx = Record<string, unknown>
export type Val<T> = T | ((ctx: Ctx) => T)
export type Task = (ctx: Ctx) => void | Promise<void>
export type Processor = (content: Buffer, file: string, ctx: Ctx) => Buffer | Promise<Buffer>
export type Job = () => Promise<void>

function resolveVal<T>(value: Val<T>, ctx: Ctx): T {
  return typeof value === 'function' ? (value as (ctx: Ctx) => T)(ctx) : value
}

/** 작업 변수를 설정한다. 같은 키는 덮어쓴다. outDir은 on()이 파일을 쓸 위치다. */
export function set(vars: Ctx): Task {
  return (ctx) => void Object.assign(ctx, vars)
}

/** 명령을 실행한다. 종료 코드가 0이 아니면 예외를 던져 작업을 멈춘다. */
export function run(command: Val<string>): Task {
  return async (ctx) => {
    const result = await Bun.$`${{ raw: resolveVal(command, ctx) }}`.quiet().nothrow()
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    if (result.exitCode) throw new Error(`command failed (exit ${result.exitCode}): ${resolveVal(command, ctx)}`)
  }
}

/** glob으로 고른 파일마다 처리를 순서대로 적용해 outDir 아래 같은 상대 경로로 쓴다. 처리가 없으면 복사한다. */
export function on(patterns: string | string[], processors: Processor | Processor[] = []): Task {
  return async (ctx) => {
    const outDir = ctx.outDir
    if (typeof outDir !== 'string') throw new Error('on(): outDir is not set, call set({ outDir }) first')
    const found = await Promise.all([patterns].flat().map((p) => Array.fromAsync(new Glob(p).scan('.'))))
    const files = found.flat()
    if (!files.length) throw new Error(`on(): no files matched ${[patterns].flat().join(', ')}`)
    for (const file of files) {
      let content: Buffer = await readFile(file)
      for (const process of [processors].flat()) content = await process(content, file, ctx)
      const dest = path.join(outDir, file)
      await mkdir(path.dirname(dest), { recursive: true })
      await writeFile(dest, content)
    }
  }
}

export function copy(): Processor {
  return (content) => content
}

/** JSON 파일을 읽어 fn이 돌려준 값으로 바꾼다. */
export function json(fn: (data: Record<string, unknown>, ctx: Ctx) => unknown): Processor {
  return (content, _file, ctx) => Buffer.from(JSON.stringify(fn(JSON.parse(content.toString()), ctx), null, 2) + '\n')
}

/** 작업 하나. 실행할 때마다 빈 변수 공간에서 시작해 Task를 순서대로 실행하고, 하나라도 실패하면 멈춘다. */
export function job(tasks: Task[]): Job {
  return async () => {
    const ctx: Ctx = {}
    for (const task of tasks) await task(ctx)
  }
}

export function defineBuild(jobs: Record<string, Job>) {
  return jobs
}
