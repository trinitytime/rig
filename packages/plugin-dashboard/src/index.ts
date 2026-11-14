import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { z } from 'zod'
import type { RigPlugin } from '@rig/core'
import { Shell } from './render.tsx'
import { pluginsPage } from './plugins-page.ts'

// 타입만 import한다: 플러그인은 런타임에 @rig/core를 import하지 않는다.
// 코어가 접두사를 떼므로 서버는 자기 주소를 모른다. 링크는 코어가 shared "http"에 알린 host/port로 만든다.
const PATH = '/dashboard/'
const read = (f: string) => readFileSync(join(import.meta.dirname, f), 'utf8')
const name = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/)
const eventBody = z.object({ page: name, id: name, value: z.unknown().optional() })
// 화면(page)이나 메뉴(menu)가 바뀐 뒤 이 시간 동안 조용하면 브라우저에 알린다.
const SETTLE_MS = 1000

const plugin: RigPlugin = (ctx) => {
  const css = read('rig-ui.css')
  const js = read('client.js')
  const clients = new Set<ReadableStreamDefaultController<string>>()

  // 플러그인이 shared "dashboard.page/<key>"에 화면 JSON을, "dashboard.menu"에 메뉴를 쓰면 신호가 오고, 열려 있는 브라우저에 알린다.
  const send = (chunk: string) => {
    for (const c of [...clients]) {
      try {
        c.enqueue(chunk)
      } catch {
        clients.delete(c)
      }
    }
  }
  const changed = ctx.timer.debounce(() => send('data: changed\n\n'), SETTLE_MS) // 연속 변경은 한 번으로 묶는다
  ctx.signal.on('shared:dashboard:page', changed)
  ctx.signal.on('shared:dashboard:menu', changed)
  // Bun은 10초 동안 아무것도 안 보내면 연결을 끊으므로 주기적으로 주석 줄을 보낸다.
  ctx.timer.setInterval(() => send(': ping\n\n'), 5000)

  const app = new Hono()
  const text = (body: string, type: string) =>
    new Response(body, { headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-cache' } })

  app.get('/', async (c) => {
    const space = await ctx.shared.get<Record<string, unknown>>('dashboard.page')
    const { host, port } = await ctx.shared.get<{ host?: string; port?: number }>('http')
    const base = host && port ? `http://${host}:${port}${PATH}` : PATH
    return c.html('<!doctype html>' + (await Shell({ base, space, current: c.req.query('p') }).toString()))
  })
  app.get('/rig-ui.css', () => text(css, 'text/css'))
  app.get('/client.js', () => text(js, 'text/javascript'))

  app.get('/events', () => {
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

  // 컨트롤 조작을 `dashboard:<화면 key>:<컨트롤 id>` 신호({ value })로 바꿔 플러그인에 전달한다.
  app.post('/event', async (c) => {
    const r = eventBody.safeParse(await c.req.json().catch(() => null))
    if (!r.success) return c.json({ error: 'bad request' }, 400)
    const b = r.data
    try {
      ctx.signal.emit(`dashboard:${b.page}:${b.id}`, { value: b.value ?? null })
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
  ctx.shared.set('dashboard.page', 'plugins', pluginsPage).catch((e) => ctx.log.error('cannot set plugins page:', e))

  ctx.shared
    .set('dashboard.menu', 'dashboard', { id: 'dashboard', name: 'Dashboard', signal: 'dashboard:open', order: 100 })
    .catch((e) => ctx.log.error('cannot add tray item:', e))

  // 기본 브라우저로 대시보드를 연다. 주소는 코어가 shared "http"에 알린 host/port로 만든다.
  ctx.signal.on('dashboard:open', async () => {
    const { host, port } = await ctx.shared.get<{ host?: string; port?: number }>('http')
    if (!host || !port) return ctx.log.error('cannot open browser: shared "http" has no host/port')
    const url = `http://${host}:${port}${PATH}`
    const [cmd, ...args] =
      process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : process.platform === 'darwin'
          ? ['open', url]
          : ['xdg-open', url]
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
