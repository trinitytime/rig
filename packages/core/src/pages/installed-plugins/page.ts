import { discoverPlugins, type DiscoveredPlugin } from '../../plugin/discovery.ts'
import type { InstalledPlugins } from '../../plugin/registry.ts'

// shortcut: 시작할 때와 새로고침 버튼을 누를 때만 스캔한 스냅샷이다 (설치 목록 파일의 활성 여부를 읽고, 토글은 읽기 전용), 변경을 다룰 때 신호를 받아 다시 만든다.

const authorName = (a: DiscoveredPlugin['manifest']['author']) => (typeof a === 'string' ? a : a?.name)

const pluginRow = ({ manifest: m, source }: DiscoveredPlugin, enabled: boolean) => ({
  type: 'row',
  label: m.name,
  meta: [`v${m.version}`, authorName(m.author), source].filter(Boolean).join(' · '),
  // shared 값은 JSON이라 undefined를 담을 수 없다.
  ...(m.description ? { description: m.description } : {}),
  items: [{ type: 'toggle', id: `toggle-${m.id}`, value: enabled, disabled: true }],
})

/** 플러그인 추가 패널의 상태: 입력한 경로, 진행 중 여부, 마지막 결과(성공 문구 또는 입력 아래에 보일 오류). */
export type AddState = {
  busy: boolean
  path: string
  archive: string
  message?: string
  error?: { target: 'path' | 'archive'; text: string }
}

const addRow = (add: AddState, target: 'path' | 'archive', label: string, description: string, placeholder: string) => ({
  type: 'row',
  label,
  description,
  items: [
    {
      type: 'input',
      id: target,
      value: add[target],
      placeholder,
      disabled: add.busy,
      ...(add.error?.target === target ? { error: add.error.text } : {}),
    },
    { type: 'button', id: `add-${target}`, text: add.busy ? '설치 중...' : '추가', disabled: add.busy },
  ],
})

/** 설치된 플러그인을 스캔해 dashboard:page 공간에 쓸 화면 JSON을 만든다. */
export function installedPluginsPage(installed: InstalledPlugins, add: AddState) {
  const enabled = new Map(installed.map((i) => [i.id, i.enabled]))
  const { plugins } = discoverPlugins(installed.flatMap((i) => (i.source === 'custom' ? [i.path] : [])))
  const on = plugins.filter((p) => enabled.get(p.manifest.id)).length
  return {
    title: 'Installed plugins',
    description: '설치된 플러그인 목록입니다.',
    status: { text: `${on}/${plugins.length} 활성`, tone: 'success' },
    items: [
      { type: 'button', id: 'refresh', text: '새로고침' }, // 누르면 코어가 다시 스캔한다 (main.ts)
      {
        type: 'section',
        title: '플러그인 추가',
        description: '운영 의존 모듈(dependencies)만 npm install한 뒤 설치 목록에 꺼진 상태로 추가합니다.',
        items: [
          addRow(add, 'path', '경로의 플러그인', '플러그인 폴더의 절대 경로입니다. 그 자리에서 설치하고 그대로 사용합니다.', '/path/to/plugin'),
          addRow(add, 'archive', '압축 파일의 플러그인', '압축 파일(.tgz 등)의 절대 경로입니다. 플러그인 설치 경로에 풀어서 설치합니다.', '/path/to/plugin.tgz'),
          ...(add.message ? [{ type: 'text', text: add.message, muted: true }] : []),
        ],
      },
      {
        type: 'section',
        title: '설치된 플러그인',
        description: `플러그인 ${plugins.length}개`,
        items: plugins.map((p) => pluginRow(p, enabled.get(p.manifest.id) ?? false)),
      },
    ],
  }
}
