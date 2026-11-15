import type { Config } from '../../config.ts'
import { addFromArchive, addFromPath } from '../../plugin/install.ts'
import type { PluginLoader } from '../../plugin/loader.ts'
import { loadInstalled } from '../../plugin/registry.ts'
import { type AddState, installedPluginsPage } from './page.ts'

const KEY = 'installed-plugins'
const noTrack = () => () => {} // 코어는 프로세스와 수명이 같아 shared 해제 함수는 필요 없다.

/**
 * 대시보드의 installed-plugins 화면: 사이드바 메뉴, 화면, 그리고 화면의 이벤트(core:installed-plugins:<컨트롤 id>)를 처리한다.
 * 메뉴와 화면은 독립이다. 화면은 시작할 때와 새로고침, 추가가 끝날 때 다시 스캔해서 쓴다.
 */
export function initInstalledPlugins(loader: PluginLoader, config: Config) {
  loader.shared.set('core', 'dashboard:menu', KEY, { name: 'Installed plugins', page: KEY, order: 100 }, noTrack)

  const add: AddState = { busy: false, path: '', archive: '' }
  const scan = () => loader.shared.set('core', 'dashboard:page', KEY, installedPluginsPage(loadInstalled(config), add), noTrack)
  scan()

  const on = (name: string, fn: (value: string) => void | Promise<void>) =>
    loader.signals.on(`core:${KEY}:${name}`, (p) => fn(String((p as { value?: unknown })?.value ?? '').trim()), console)
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
}
