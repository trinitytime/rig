import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Processor } from './index.ts'

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']
const WORKSPACE_PREFIX = 'workspace:'

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
