import { PluginLoader } from './plugin/loader.ts'
import { DEFAULT_HOST, resolvePort, startServer } from './server.ts'

type Server = Awaited<ReturnType<typeof startServer>>

// 초기화: 종료 처리, 트레이의 Exit 항목, 서버 주소 공유. 코어는 프로세스와 수명이 같아 shared 해제 함수는 필요 없다.
function init(loader: PluginLoader, getServer: () => Server | undefined) {
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
    'dashboard.menu',
    'exit',
    { id: 'exit', name: 'Exit', signal: 'core:exit', order: 9999 },
    () => () => {},
  )
  loader.signals.on('core:exit', () => shutdown(), console)
  // 서버가 쓸 host와 port를 shared의 http 공간에 알린다 (플러그인이 자기 주소를 알아야 할 때 읽는다).
  const host = DEFAULT_HOST
  const port = resolvePort()
  loader.shared.set('core', 'http', 'host', host, () => () => {})
  loader.shared.set('core', 'http', 'port', port, () => () => {})
  return { host, port }
}

// 서버 구동
const serve = (loader: PluginLoader, host: string, port: number) => startServer({ loader, host, port })

// 플러그인 로드: 서버가 완전히 뜬 뒤에 한다 (로드 중에도 /health 등에 응답하고, 플러그인 API는 로드되는 대로 열린다).
async function loadPlugins(loader: PluginLoader) {
  const statuses = await loader.loadAll()
  for (const s of statuses) console.log(`[rig] plugin ${s.id}: ${s.state}${s.error ? ` (${s.error})` : ''}`)
}

async function main() {
  const loader = new PluginLoader()
  let server: Server | undefined
  const { host, port } = init(loader, () => server)
  server = await serve(loader, host, port)
  await loadPlugins(loader)
}

await main()
