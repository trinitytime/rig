import { discoverPlugins, type DiscoveredPlugin } from './discovery.ts'
import type { InstalledPlugins } from './registry.ts'

// shortcut: 시작할 때 한 번 스캔한 스냅샷이다 (설치, 삭제, 켜고 끄기가 반영되지 않고 토글은 읽기 전용), 변경을 다룰 때 신호를 받아 다시 만든다.

const authorName = (a: DiscoveredPlugin['manifest']['author']) => (typeof a === 'string' ? a : a?.name)

const pluginRow = ({ manifest: m, source }: DiscoveredPlugin, enabled: boolean) => ({
  type: 'row',
  label: m.name,
  meta: [`v${m.version}`, authorName(m.author), source].filter(Boolean).join(' · '),
  // shared 값은 JSON이라 undefined를 담을 수 없다.
  ...(m.description ? { description: m.description } : {}),
  items: [{ type: 'toggle', id: `toggle-${m.id}`, value: enabled, disabled: true }],
})

/** 설치된 플러그인을 스캔해 dashboard:page 공간에 쓸 화면 JSON을 만든다. */
export function installedPluginsPage(installed: InstalledPlugins) {
  const enabled = new Map(installed.map((i) => [i.id, i.enabled]))
  const { plugins } = discoverPlugins(installed.flatMap((i) => (i.source === 'custom' ? [i.path] : [])))
  const on = plugins.filter((p) => enabled.get(p.manifest.id)).length
  return {
    title: 'Installed plugins',
    description: '설치된 플러그인 목록입니다.',
    status: { text: `${on}/${plugins.length} 활성`, tone: 'success' },
    items: [
      {
        type: 'section',
        title: '설치된 플러그인',
        description: `플러그인 ${plugins.length}개`,
        items: plugins.map((p) => pluginRow(p, enabled.get(p.manifest.id) ?? false)),
      },
    ],
  }
}
