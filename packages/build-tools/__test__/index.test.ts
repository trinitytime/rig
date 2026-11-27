import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { clean, copy, job, json, on, run, set, workspaceDeps } from '../src/index.ts'

async function inTempDir(fn: (dir: string) => Promise<void>) {
  const cwd = process.cwd()
  const dir = await mkdtemp(path.join(tmpdir(), 'build-tools-'))
  process.chdir(dir)
  try {
    await fn(dir)
  } finally {
    process.chdir(cwd)
  }
}

test('on: 처리를 순서대로 적용하고 같은 파일은 뒤 Task가 덮어쓴다', () =>
  inTempDir(async (dir) => {
    await writeFile('a.json', '{"n":1}')
    await job([
      set({ outDir: 'out', add: 10 }),
      on('a.json', copy()),
      on('a.json', [json((d, ctx) => ({ n: (d.n as number) + 1, add: ctx.add })), json((d) => ({ ...d, done: true }))]),
    ])()
    expect(JSON.parse(await readFile(path.join(dir, 'out/a.json'), 'utf8'))).toEqual({ n: 2, add: 10, done: true })
  }))

test('on: outDir가 없으면 실패하고, 고른 파일이 없으면 건너뛴다', () =>
  inTempDir(async () => {
    await writeFile('a.txt', 'x')
    expect(job([on('a.txt')])()).rejects.toThrow('outDir')
    await job([set({ outDir: 'out' }), on('none.txt')])()
    expect(Bun.file('out').exists()).resolves.toBe(false)
  }))

test('run: 변수를 명령에 쓰고, 실패하면 뒤 Task를 실행하지 않는다', () =>
  inTempDir(async (dir) => {
    await job([set({ name: 'hi' }), run(({ name }) => `echo ${name} > r.txt`)])()
    expect((await readFile(path.join(dir, 'r.txt'), 'utf8')).trim()).toBe('hi')
    expect(job([run('exit 3'), run('echo no > after.txt')])()).rejects.toThrow('exit 3')
    expect(Bun.file(path.join(dir, 'after.txt')).exists()).resolves.toBe(false)
  }))

test('copy: 목적지 함수로 outDir 아래 경로를 바꾼다', () =>
  inTempDir(async (dir) => {
    await mkdir('aaa/sub', { recursive: true })
    await writeFile('aaa/b.js', 'b')
    await writeFile('aaa/sub/c.js', 'c')
    await job([
      set({ outDir: 'out' }),
      on(
        'aaa/**/*.js',
        copy((file) => file.replace('aaa', 'ccc')),
      ),
    ])()
    expect(await readFile(path.join(dir, 'out/ccc/b.js'), 'utf8')).toBe('b')
    expect(await readFile(path.join(dir, 'out/ccc/sub/c.js'), 'utf8')).toBe('c')
  }))

test('copy: 문자열 목적지로 파일 하나의 경로를 바꾼다', () =>
  inTempDir(async (dir) => {
    await mkdir('aaa')
    await writeFile('aaa/bbb.js', 'b')
    await job([set({ outDir: 'out' }), on('aaa/bbb.js', copy('ccc/bbb.js'))])()
    expect(await readFile(path.join(dir, 'out/ccc/bbb.js'), 'utf8')).toBe('b')
  }))

test('json: 최상위 값이 null인 키는 지운다', () =>
  inTempDir(async (dir) => {
    await writeFile('a.json', '{"keep":1,"scripts":{"x":1},"nested":{"n":1}}')
    await job([
      set({ outDir: 'out' }),
      on(
        'a.json',
        json((d) => ({ ...d, scripts: null, nested: { n: null } })),
      ),
    ])()
    expect(JSON.parse(await readFile(path.join(dir, 'out/a.json'), 'utf8'))).toEqual({ keep: 1, nested: { n: null } })
  }))

test('clean: outDir을 지우되 없거나 현재 경로 자신·상위·바깥이면 아무것도 하지 않는다', () =>
  inTempDir(async (dir) => {
    await mkdir('out/sub', { recursive: true })
    await writeFile('out/sub/a.txt', 'x')
    await writeFile('keep.txt', 'x')
    await job([clean()])() // outDir 없음
    await job([set({ outDir: '.' }), clean()])()
    await job([set({ outDir: dir }), clean()])()
    await job([set({ outDir: '..' }), clean()])()
    await job([set({ outDir: '/' }), clean()])()
    expect(await Bun.file('keep.txt').exists()).toBe(true)
    expect(await Bun.file('out/sub/a.txt').exists()).toBe(true)
    await job([set({ outDir: 'out' }), clean()])()
    expect(await Bun.file('out/sub/a.txt').exists()).toBe(false)
    expect(await Bun.file('keep.txt').exists()).toBe(true)
    await job([set({ outDir: 'nothing' }), clean()])() // 없는 폴더는 오류 없이 통과
  }))

test('workspaceDeps: workspace: 항목을 node_modules의 실제 버전 범위로 바꾼다', () =>
  inTempDir(async (dir) => {
    await mkdir('node_modules/@x/dep', { recursive: true })
    await writeFile('node_modules/@x/dep/package.json', '{"version":"1.2.3"}')
    const pkg = {
      dependencies: { '@x/dep': 'workspace:*', zod: '^4.0.0' },
      peerDependencies: { '@x/dep': 'workspace:~' },
      optionalDependencies: { '@x/dep': 'workspace:^1.0.0' },
    }
    await writeFile('package.json', JSON.stringify(pkg))
    await job([set({ outDir: 'out' }), on('package.json', workspaceDeps())])()
    const out = JSON.parse(await readFile(path.join(dir, 'out/package.json'), 'utf8'))
    expect(out.dependencies).toEqual({ '@x/dep': '^1.2.3', zod: '^4.0.0' })
    expect(out.peerDependencies).toEqual({ '@x/dep': '~1.2.3' })
    expect(out.optionalDependencies).toEqual({ '@x/dep': '^1.0.0' })
    await writeFile('package.json', '{"dependencies":{"@x/none":"workspace:*"}}')
    expect(job([set({ outDir: 'out' }), on('package.json', workspaceDeps())])()).rejects.toThrow('not found')
  }))
