import { chmodSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { PluginContext, RigPlugin } from '@rig/core'
import { z } from 'zod'
import * as mod from 'systray2'
import type SysTrayType from 'systray2'
import type { MenuItem } from 'systray2'

// systray2는 CJS라 ESM에서는 default가 한 겹 더 감싸질 수 있다.
const m: any = mod
const SysTray: typeof SysTrayType.default = m.default?.default ?? m.default ?? m

// 마지막 신호 뒤 이 시간 동안 조용하면 shared "dashboard.menu"를 읽어 트레이를 구성한다. 신호가 오면 다시 이 시간만큼 미룬다.
const SETTLE_MS = 1000

// 이웃한 항목의 order 차이가 이 값 이상이면 그 사이에 구분선을 넣는다.
const SEPARATOR_GAP = 100

const trayItem = z.object({ id: z.string(), name: z.string(), signal: z.string(), order: z.number() })
type TrayItem = z.infer<typeof trayItem>

// shortcut: Windows는 어두운 작업 표시줄용(dark) 아이콘만 쓴다, 테마 감지가 필요하면 light.ico와 전환.
const trayIcons = {
  win32: 'windows/rig-tray-dark.ico',
  darwin: 'macos/rigTemplate-2x.png',
  linux: 'linux/rig-tray-22.png',
} as Record<string, string>
const iconFile = trayIcons[process.platform] ?? trayIcons.linux!
const icon = readFileSync(join(import.meta.dirname, '../../../assets/rig-icons/tray', iconFile)).toString('base64')

// systray2의 chmod('+x')가 실패해도 조용히 넘어가(특히 Bun) 실행 권한 없이 spawn되므로 직접 준다.
const allowExec = () => {
  if (process.platform === 'win32') return
  const bin = join(
    dirname(createRequire(import.meta.url).resolve('systray2')),
    'traybin',
    `tray_${process.platform === 'darwin' ? 'darwin' : 'linux'}_release`,
  )
  chmodSync(bin, 0o755)
}

const build = async (ctx: PluginContext, signals: Map<MenuItem, string>) => {
  const space = await ctx.shared.get('dashboard.menu')
  const items = Object.values(space)
    .flatMap((v) => {
      const r = trayItem.safeParse(v)
      if (!r.success) ctx.log.warn('ignored invalid tray value:', v)
      return r.success ? [r.data] : []
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .flatMap((t, i, all) => {
      const item: MenuItem = { title: t.name, tooltip: t.name, enabled: true }
      signals.set(item, t.signal)
      const prev = all[i - 1]
      return prev && t.order - prev.order >= SEPARATOR_GAP ? [SysTray.separator, item] : [item]
    })
  return { icon, isTemplateIcon: process.platform === 'darwin', title: '', tooltip: 'rig', items }
}

const start = async (ctx: PluginContext, menu: Awaited<ReturnType<typeof build>>, signals: Map<MenuItem, string>) => {
  const tray = new SysTray({ menu })
  await tray.ready() // 프로세스가 뜬 뒤에야 이벤트를 붙일 수 있다.
  tray.onError((e) => ctx.log.error('systray failed:', e))
  void tray.onClick(({ item }) => {
    const signal = signals.get(item)
    if (!signal) return
    try {
      ctx.signal.emit(signal)
    } catch (e) {
      ctx.log.error(`cannot emit "${signal}":`, e)
    }
  })
  return tray
}

const plugin: RigPlugin = async (ctx) => {
  allowExec()
  let tray: InstanceType<typeof SysTray> | undefined
  let queue: Promise<unknown> = Promise.resolve()

  // 항목이 하나도 없으면 아무것도 하지 않는다(기존 트레이도 그대로 둔다).
  // Linux 트레이 바이너리는 update-menu로 항목 수를 바꾸지 못하므로, 갱신은 트레이를 닫고 다시 띄운다.
  // shortcut: 재시작 동안 아이콘이 잠깐 사라진다, 거슬리면 Linux 외 OS만 update-menu를 쓰거나 숨김 항목을 미리 만들어 둔다.
  const refresh = async () => {
    const signals = new Map<MenuItem, string>()
    const menu = await build(ctx, signals)
    if (menu.items.length === 0) return
    await tray?.kill(false)
    tray = undefined
    tray = await start(ctx, menu, signals)
  }

  const schedule = ctx.timer.debounce(() => {
    queue = queue.then(refresh).catch((e) => ctx.log.error('cannot refresh tray:', e))
  }, SETTLE_MS)
  schedule() // 초기화 후 SETTLE_MS 동안 신호가 없으면 처음 구성한다
  ctx.signal.on('shared:dashboard.menu', schedule)

  return async () => {
    await queue
    await tray?.kill(false)
  }
}
export default plugin
