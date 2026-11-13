import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import type { RigPlugin } from '@rig/core'
import { Shell } from './render.tsx'

// 타입만 import한다: 플러그인은 런타임에 @rig/core를 import하지 않는다.
// 코어가 접두사를 떼므로 서버는 자기 주소를 모른다. 링크는 코어가 shared "http"에 알린 host/port로 만든다.
const PATH = '/dashboard/'
const DASHBOARD_URL = 'http://localhost:7440/dashboard'
const read = (f: string) => readFileSync(join(import.meta.dirname, f), 'utf8')
const name = /^[A-Za-z0-9_.-]{1,64}$/

const plugin: RigPlugin = (ctx) => {
  const css = read('rig-ui.css')
  const js = read('client.js')
  const clients = new Set<ReadableStreamDefaultController<string>>()

  // 플러그인이 shared "ui/<key>"에 화면 JSON을 쓰면 이 신호가 오고, 열려 있는 브라우저에 알린다.
  let pending = false
  const send = (chunk: string) => {
    for (const c of [...clients]) {
      try {
        c.enqueue(chunk)
      } catch {
        clients.delete(c)
      }
    }
  }
  ctx.signal.on('shared:ui', () => {
    if (pending) return // 짧은 시간의 연속 변경은 한 번으로 묶는다
    pending = true
    ctx.timer.setTimeout(() => {
      pending = false
      send('data: changed\n\n')
    }, 50)
  })
  // Bun은 10초 동안 아무것도 안 보내면 연결을 끊으므로 주기적으로 주석 줄을 보낸다.
  ctx.timer.setInterval(() => send(': ping\n\n'), 5000)

  const app = new Hono()
  const text = (body: string, type: string) =>
    new Response(body, { headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-cache' } })

  app.get('/', async (c) => {
    const space = await ctx.shared.get<Record<string, unknown>>('ui')
    const { host, port } = await ctx.shared.get<{ host?: string; port?: number }>('http')
    const base = host && port ? `http://${host}:${port}${PATH}` : PATH
    return c.html('<!doctype html>' + (await Shell({ base, space, current: c.req.query('p') }).toString()))
  })
  app.get('/rig-ui.css', () => text(css, 'text/css'))
  app.get('/client.js', () => text(js, 'text/javascript'))

  app.get('/events', (c) => {
    let self: ReadableStreamDefaultController<string>
    const stream = new ReadableStream<string>({
      start(controller) {
        self = controller
        clients.add(controller)
        controller.enqueue(': ok\n\n')
      },
      cancel() {
        clients.delete(self)
      },
    })
    return new Response(stream.pipeThrough(new TextEncoderStream()), {
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
    })
  })

  // 컨트롤 조작을 `ui:<화면 key>:<컨트롤 id>` 신호({ value })로 바꿔 플러그인에 전달한다.
  app.post('/event', async (c) => {
    const b = (await c.req.json().catch(() => null)) as { page?: unknown; id?: unknown; value?: unknown } | null
    if (typeof b?.page !== 'string' || typeof b.id !== 'string' || !name.test(b.page) || !name.test(b.id))
      return c.json({ error: 'bad request' }, 400)
    try {
      ctx.signal.emit(`ui:${b.page}:${b.id}`, { value: b.value ?? null })
    } catch (e) {
      ctx.log.error('cannot emit ui event:', e)
      return c.json({ error: 'bad request' }, 400)
    }
    return c.body(null, 204)
  })

  ctx.http.fetch((req) => app.fetch(req))

  ctx.shared
    .set('http', '/', '/dashboard') // 코어가 / 요청을 이 주소로 보낸다
    .catch((e) => ctx.log.error('cannot set home page:', e))
  ctx.shared
    .set('tray', 'dashboard', { id: 'dashboard', name: 'Dashboard', signal: 'dashboard:open', order: 100 })
    .catch((e) => ctx.log.error('cannot add tray item:', e))

  // 기본 브라우저로 대시보드를 연다. 플러그인은 코어의 포트 상수를 import하지 않으므로 주소를 고정해 둔다.
  ctx.signal.on('dashboard:open', () => {
    const [cmd, ...args] =
      process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', DASHBOARD_URL]
        : process.platform === 'darwin'
          ? ['open', DASHBOARD_URL]
          : ['xdg-open', DASHBOARD_URL]
    spawn(cmd!, args, { stdio: 'ignore', detached: true })
      .on('error', (e) => ctx.log.error('cannot open browser:', e))
      .unref()
  })

  return () => {
    for (const c of clients) c.close()
    clients.clear()
  }
}
export default plugin
