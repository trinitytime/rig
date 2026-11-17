import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Config } from '../config.ts'
import { rigHome } from '../paths.ts'
import { discoverPlugins } from './discovery.ts'
import { extract } from './extract.ts'
import { parseManifest, type PluginManifest } from './manifest.ts'
import { addInstalled, loadInstalled } from './registry.ts'
import { run } from './run.ts'

// shortcut: 설치 중 진행 상황과 취소는 없다, 오래 걸리는 설치가 많아지면 로그를 흘리거나 중단 신호를 받는다.

/**
 * 운영 의존 모듈(dependencies, optionalDependencies)만 설치한다.
 * npm은 --omit=dev를 줘도 devDependencies와 peerDependencies(@rig-works/core 등 게시되지 않은 것)를 해석하다 실패하므로,
 * 운영 의존성만 적은 임시 package.json으로 설치하고 node_modules만 플러그인 폴더에 복사한다 (플러그인 폴더의 package.json은 건드리지 않는다).
 */
// shortcut: 의존성의 상대 경로(file:../x)는 임시 폴더 기준이 되어 깨진다, 필요해지면 절대 경로로 바꿔 적는다. node_modules는 복사해서 큰 트리는 느리다.
async function npmInstall(dir: string) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-npm-'))
  try {
    const { name, version, dependencies, optionalDependencies } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name, version, dependencies, optionalDependencies }))
    await run('npm', ['install', '--omit=dev', '--no-package-lock'], tmp)
    if (fs.existsSync(path.join(tmp, 'node_modules')))
      fs.cpSync(path.join(tmp, 'node_modules'), path.join(dir, 'node_modules'), { recursive: true, force: true, verbatimSymlinks: true })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/** 플러그인 폴더의 package.json을 읽어 rig 항목을 검증한다. */
function readPlugin(dir: string): PluginManifest {
  const file = path.join(dir, 'package.json')
  if (!fs.existsSync(file)) throw new Error(`package.json not found in ${dir}`)
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!pkg.rig) throw new Error('package.json has no "rig" field (not a rig plugin)')
  return parseManifest(pkg)
}

/** 같은 id의 플러그인이 이미 설치 목록이나 탐색 결과에 있으면 던진다. */
function assertNew(id: string, config: Config) {
  const list = loadInstalled(config)
  const custom = list.flatMap((i) => (i.source === 'custom' ? [i.path] : []))
  if (list.some((i) => i.id === id) || discoverPlugins(custom).plugins.some((p) => p.manifest.id === id))
    throw new Error(`plugin "${id}" is already installed`)
}

/** 임의의 경로에 있는 플러그인 폴더에서 운영 의존 모듈을 설치하고 설치 목록에 (꺼진 상태로) 추가한다. */
export async function addFromPath(config: Config, dir: string): Promise<PluginManifest> {
  if (!path.isAbsolute(dir)) throw new Error('path must be absolute')
  const m = readPlugin(dir)
  assertNew(m.id, config)
  await npmInstall(dir)
  addInstalled(config, { id: m.id, source: 'custom', enabled: false, path: path.resolve(dir) })
  return m
}

// 압축 파일의 맨 위가 package.json이거나, 폴더 하나(npm pack의 package/)다.
function packageRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, 'package.json'))) return dir
  const entries = fs.readdirSync(dir)
  const only = entries.length === 1 ? path.join(dir, entries[0]!) : undefined
  if (only && fs.existsSync(path.join(only, 'package.json'))) return only
  throw new Error('package.json not found in the archive')
}

/** 압축 파일을 플러그인 설치 경로(<RIG_HOME>/plugins/node_modules/<id>)에 풀고 운영 의존 모듈을 설치해 설치 목록에 (꺼진 상태로) 추가한다. */
export async function addFromArchive(config: Config, file: string): Promise<PluginManifest> {
  if (!path.isAbsolute(file) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error('archive file not found')
  const plugins = path.join(rigHome(), 'plugins')
  fs.mkdirSync(path.join(plugins, 'node_modules'), { recursive: true })
  const tmp = fs.mkdtempSync(path.join(plugins, '.extract-')) // node_modules 밖이라 탐색에 잡히지 않고, 같은 볼륨이라 rename이 된다
  let dest: string | undefined
  try {
    await extract(file, tmp)
    const root = packageRoot(tmp)
    const m = readPlugin(root)
    assertNew(m.id, config)
    const target = path.join(plugins, 'node_modules', m.id)
    if (fs.existsSync(target)) throw new Error(`${target} already exists`)
    fs.renameSync(root, target)
    dest = target // 지우는 것은 우리가 방금 옮긴 폴더뿐이다
    await npmInstall(dest)
    addInstalled(config, { id: m.id, source: 'user', enabled: false })
    return m
  } catch (e) {
    if (dest) fs.rmSync(dest, { recursive: true, force: true }) // 반쯤 설치된 폴더를 남기지 않는다
    throw e
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/** 입력이 폴더면 그 자리에서, 파일이면 압축 파일로 보고 설치한다. */
export async function addPlugin(config: Config, p: string): Promise<PluginManifest> {
  if (!path.isAbsolute(p)) throw new Error('path must be absolute')
  const stat = fs.statSync(p, { throwIfNoEntry: false })
  if (!stat) throw new Error(`${p} not found`)
  return stat.isDirectory() ? addFromPath(config, p) : addFromArchive(config, p)
}
