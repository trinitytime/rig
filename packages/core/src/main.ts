import { type Config, readConfig } from './config.ts'
import { addFromArchive, addFromPath } from './plugin/install.ts'
import { type AddState, installedPluginsPage } from './plugin/installed-page.ts'
import { PluginLoader } from './plugin/loader.ts'
import { loadInstalled } from './plugin/registry.ts'
import { DEFAULT_HOST, resolvePort, startServer } from './server.ts'

type Server = Awaited<ReturnType<typeof startServer>>

// 초기화: 종료 처리, 트레이의 Exit 항목, 서버 주소 공유, 설치된 플러그인 화면. 코어는 프로세스와 수명이 같아 shared 해제 함수는 필요 없다.
function init(loader: PluginLoader, config: Config, getServer: () => Server | undefined) {
  let closing = false
  const shutdown = async () => {
    if (closing) return // 신호가 두 번 와도 한 번만 정리한다
    closing = true
    getServer()?.close() // 서버가 뜨기 전에 호출될 수도 있다
    await loader.unloadAll()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  loader.shared.set(
    'core',
    'tray:menu',
    'exit',
    { id: 'exit', name: 'Exit', signal: 'core:exit', order: 9999 },
    () => () => {},
  )
  loader.signals.on('core:exit', () => shutdown(), console)
  // 서버가 쓸 host와 port를 shared의 http 공간에 알린다 (플러그인이 자기 주소를 알아야 할 때 읽는다).
  const host = DEFAULT_HOST
  const port = resolvePort(undefined, config.port)
  loader.shared.set('core', 'http', 'host', host, () => () => {})
  loader.shared.set('core', 'http', 'port', port, () => () => {})
  // 대시보드 사이드바에서 installed-plugins 화면으로 가는 메뉴 (메뉴와 화면은 독립이다).
  loader.shared.set('core', 'dashboard:menu', 'installed-plugins', { name: 'Installed plugins', page: 'installed-plugins', order: 100 }, () => () => {})
  // 설치된 플러그인을 스캔해 대시보드의 'installed-plugins' 화면으로 알린다. 화면의 새로고침 버튼을 누르면 다시 스캔한다.
  const add: AddState = { busy: false, path: '', archive: '' }
  const scan = () =>
    loader.shared.set('core', 'dashboard:page', 'installed-plugins', installedPluginsPage(loadInstalled(config), add), () => () => {})
  scan()
  const on = (name: string, fn: (value: string) => void | Promise<void>) =>
    loader.signals.on(`core:installed-plugins:${name}`, (p) => fn(String((p as { value?: unknown })?.value ?? '').trim()), console)
  on('refresh', scan)
  // 입력은 바뀔 때마다 값만 기억해 두고, 추가 버튼을 누르면 그 값으로 설치한다.
  // shortcut: 설치는 한 번에 하나만 한다 (진행 중이면 버튼과 입력을 잠근다), 동시 설치가 필요하면 대기열을 둔다.
  on('path', (v) => void (add.path = v))
  on('archive', (v) => void (add.archive = v))
  const install = (target: 'path' | 'archive', fn: (config: Config, p: string) => Promise<{ name: string }>) => async () => {
    if (add.busy || !add[target]) return
    Object.assign(add, { busy: true, message: undefined, error: undefined })
    scan()
    try {
      const m = await fn(config, add[target])
      Object.assign(add, { [target]: '', message: `${m.name}을(를) 추가했습니다 (꺼진 상태).` })
    } catch (e) {
      add.error = { target, text: e instanceof Error ? e.message : String(e) }
    }
    add.busy = false
    scan()
  }
  on('add-path', install('path', addFromPath))
  on('add-archive', install('archive', addFromArchive))
  return { host, port }
}

// 서버 구동
const serve = (loader: PluginLoader, host: string, port: number) => startServer({ loader, host, port })

// 플러그인 로드: 서버가 완전히 뜬 뒤에 한다 (로드 중에도 /health 등에 응답하고, 플러그인 API는 로드되는 대로 열린다).
async function loadPlugins(loader: PluginLoader, config: Config) {
  const statuses = await loader.loadAll(loadInstalled(config))
  for (const s of statuses) console.log(`[rig] plugin ${s.id}: ${s.state}${s.error ? ` (${s.error})` : ''}`)
}

async function main() {
  const loader = new PluginLoader()
  let server: Server | undefined
  const config = readConfig()
  const { host, port } = init(loader, config, () => server)
  server = await serve(loader, host, port)
  await loadPlugins(loader, config)
}

await main()
