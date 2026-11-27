import { expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { copy, job, json, on, run, set } from './index.ts'

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

test('on: outDir가 없거나 파일이 없으면 실패한다', () =>
  inTempDir(async () => {
    await writeFile('a.txt', 'x')
    expect(job([on('a.txt')])()).rejects.toThrow('outDir')
    expect(job([set({ outDir: 'out' }), on('none.txt')])()).rejects.toThrow('no files matched')
  }))

test('run: 변수를 명령에 쓰고, 실패하면 뒤 Task를 실행하지 않는다', () =>
  inTempDir(async (dir) => {
    await job([set({ name: 'hi' }), run(({ name }) => `echo ${name} > r.txt`)])()
    expect((await readFile(path.join(dir, 'r.txt'), 'utf8')).trim()).toBe('hi')
    expect(job([run('exit 3'), run('echo no > after.txt')])()).rejects.toThrow('exit 3')
    expect(Bun.file(path.join(dir, 'after.txt')).exists()).resolves.toBe(false)
  }))
