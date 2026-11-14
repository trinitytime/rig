// 플러그인 목록 화면 (shared "dashboard.page/plugins"에 쓴다). 지금은 더미 데이터다.
// shortcut: 데이터가 고정된 더미다, 실제 목록은 코어의 /api/plugins 같은 출처에서 읽어 만든다.
const plugins = [
  { id: 'systray', name: 'Systray', description: '시스템 트레이 메뉴', active: true },
  { id: 'browser', name: 'Browser', description: '브라우저 자동화 (stub)', active: true },
  { id: 'dashboard', name: 'Dashboard', description: '선언형 플러그인 화면', active: true },
  { id: 'storage', name: 'Storage', description: '플러그인 데이터 저장소', active: false },
]

// 토글을 바꾸면 `dashboard:plugins:toggle-<id>` 신호({ value })가 나간다.
export const pluginsPage = {
  title: 'Plugins',
  description: '설치된 플러그인을 켜고 끕니다.',
  status: { text: `${plugins.filter((p) => p.active).length}/${plugins.length} 활성`, tone: 'success' },
  items: [
    {
      type: 'section',
      title: '설치된 플러그인',
      description: `플러그인 ${plugins.length}개`,
      items: plugins.map((p) => ({
        type: 'toggle',
        id: `toggle-${p.id}`,
        label: p.name,
        description: p.description,
        value: p.active,
      })),
    },
  ],
}
