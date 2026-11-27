import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'tinyglobby'
import { $ } from 'zx'

// shortcut: ctx를 Record<string, unknown>으로만 다룬다(변수 타입 검사 없음), 변수가 늘어 오타가 잦아지면 job 제네릭으로 올린다.
export type Ctx = Record<string, unknown>
export type Val<T> = T | ((ctx: Ctx) => T)
export type Task = (ctx: Ctx) => void | Promise<void>
// 처리는 내용(Buffer)만 돌려주거나, 내용과 함께 outDir 아래에 쓸 상대 경로(file)를 돌려준다.
export type Output = Buffer | { content: Buffer; file: string }
export type Processor = (content: Buffer, file: string, ctx: Ctx) => Output | Promise<Output>
export type Job = () => Promise<void>

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']
const WORKSPACE_PREFIX = 'workspace:'

function resolveVal<T>(value: Val<T>, ctx: Ctx): T {
  return typeof value === 'function' ? (value as (ctx: Ctx) => T)(ctx) : value
}

/** 작업 변수를 설정한다. 같은 키는 덮어쓴다. outDir은 on()이 파일을 쓸 위치다. */
export function set(vars: Ctx): Task {
  return (ctx) => void Object.assign(ctx, vars)
}

// shortcut: zx 기본 셸(bash)을 쓴다 — Windows에서 bash가 없으면 $.shell을 바꿔야 한다.
/** 명령을 실행한다. 종료 코드가 0이 아니면 예외를 던져 작업을 멈춘다. */
export function run(command: Val<string>): Task {
  return async (ctx) => {
    const result = await $({
      cwd: process.cwd(),
      quote: (text) => text,
      quiet: true,
      nothrow: true,
    })`${resolveVal(command, ctx)}`
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    if (result.exitCode) throw new Error(`command failed (exit ${result.exitCode}): ${resolveVal(command, ctx)}`)
  }
}

/**
 * outDir을 지운다. outDir이 없으면 아무것도 하지 않는다.
 * 지워도 되는 건 현재 경로 안쪽의 하위 경로뿐이다: 현재 경로 자신, 상위 경로(루트·홈 포함), 바깥 경로는 경고만 하고 건너뛴다.
 */
export function clean(): Task {
  return async (ctx) => {
    const outDir = ctx.outDir
    if (typeof outDir !== 'string' || !outDir.trim()) return
    const cwd = process.cwd()
    const target = path.resolve(cwd, outDir)
    const rel = path.relative(cwd, target)
    if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      console.warn(`clean(): skipped, "${target}" is not inside ${cwd}`)
      return
    }
    await rm(target, { recursive: true, force: true }) // 심볼릭 링크는 링크만 지우고 가리키는 곳은 건드리지 않는다.
  }
}

/** glob으로 고른 파일마다 처리를 순서대로 적용해 outDir 아래 같은 상대 경로로 쓴다. 처리가 없으면 복사한다. 고른 파일이 없으면 건너뛴다. */
export function on(patterns: string | string[], processors: Processor | Processor[] = []): Task {
  return async (ctx) => {
    const outDir = ctx.outDir
    if (typeof outDir !== 'string') throw new Error('on(): outDir is not set, call set({ outDir }) first')
    const files = await glob(patterns)
    for (const file of files) {
      let content: Buffer = await readFile(file)
      let target = file
      for (const process of [processors].flat()) {
        const out = await process(content, target, ctx)
        if (Buffer.isBuffer(out)) content = out
        else ({ content, file: target } = out)
      }
      const dest = path.join(outDir, target)
      await mkdir(path.dirname(dest), { recursive: true })
      await writeFile(dest, content)
    }
  }
}

/** 내용은 그대로 두고, dest가 있으면 outDir 아래에 쓸 경로를 바꾼다. 문자열이면 그 경로로, 함수이면 dest(원래 경로)로 쓴다. */
export function copy(dest?: string | ((file: string, ctx: Ctx) => string)): Processor {
  return (content, file, ctx) =>
    dest === undefined ? content : { content, file: typeof dest === 'function' ? dest(file, ctx) : dest }
}

// shortcut: 최상위 키의 null만 지운다(중첩 객체 안의 null은 그대로), 중첩까지 필요해지면 재귀로 올린다.
/** JSON 파일을 읽어 fn이 돌려준 값으로 바꾼다. 최상위 객체의 값이 null인 키는 지운다. */
export function json(fn: (data: Record<string, unknown>, ctx: Ctx) => unknown): Processor {
  return (content, _file, ctx) => {
    const result = fn(JSON.parse(content.toString()), ctx)
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const obj = result as Record<string, unknown>
      for (const key of Object.keys(obj)) if (obj[key] === null) delete obj[key]
    }
    return Buffer.from(JSON.stringify(result, null, 2) + '\n')
  }
}

/** 현재 경로부터 위로 올라가며 node_modules/<name>/package.json(워크스페이스 링크)의 버전을 찾는다. */
async function readWorkspaceVersion(name: string): Promise<string> {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', name, 'package.json')
    const text = await readFile(file, 'utf8').catch(() => undefined)
    if (text) return JSON.parse(text).version
    if (dir === path.dirname(dir)) throw new Error(`workspace package not found: ${name} (run install first)`)
  }
}

// shortcut: workspace:*, ^, ~ 와 workspace:<범위>만 다룬다(workspace:이름@* 별칭은 그대로 둔다), 필요해지면 별칭 처리를 추가한다.
function toRange(spec: string, version: string) {
  if (spec === '' || spec === '*' || spec === '^') return `^${version}`
  if (spec === '~') return `~${version}`
  return spec
}

/** package.json의 dependencies, peerDependencies, optionalDependencies에서 workspace: 항목을 실제 버전 범위(^버전)로 바꾼다. */
export function workspaceDeps(): Processor {
  return async (content) => {
    const pkg = JSON.parse(content.toString())
    for (const field of DEP_FIELDS) {
      const deps: Record<string, string> | undefined = pkg[field]
      for (const [name, value] of Object.entries(deps ?? {})) {
        if (!value.startsWith(WORKSPACE_PREFIX)) continue
        deps![name] = toRange(value.slice(WORKSPACE_PREFIX.length), await readWorkspaceVersion(name))
      }
    }
    return Buffer.from(JSON.stringify(pkg, null, 2) + '\n')
  }
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
