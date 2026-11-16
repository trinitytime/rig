// 대시보드가 읽는 shared 값의 형태.
//  - "dashboard:menu"의 값 하나: DashboardMenuItem (사이드바 메뉴)
//  - "dashboard:page"의 값 하나: DashboardPage (화면, key가 주소 /dashboard/<key>가 된다)

/** 사이드바 메뉴 항목 하나. */
export interface DashboardMenuItem {
  /** 메뉴에 보이는 이름. */
  name: string
  /** 이동할 화면의 key (dashboard:page의 key). */
  page: string
  /** 정렬 순서(작을수록 위, 기본 0). */
  order?: number
}

export type DashboardTone = 'success' | 'warning' | 'danger'

/**
 * 컨트롤이 공통으로 갖는 값. 컨트롤을 조작하면 신호 `<화면을 등록한 플러그인 id>:<화면 key>:<id>`가 { value }와 함께 발행된다 (id가 없으면 읽기 전용).
 */
interface ControlBase {
  id?: string
  disabled?: boolean
  /** 있으면 컨트롤 아래에 오류 문구로 보인다. */
  error?: string
}

export interface ToggleItem extends ControlBase {
  type: 'toggle'
  value?: boolean
}
export interface InputItem extends ControlBase {
  type: 'input'
  inputType?: 'text' | 'number' | 'password'
  value?: string | number
  placeholder?: string
  min?: number
  max?: number
  pattern?: string
  required?: boolean
}
export interface TextareaItem extends ControlBase {
  type: 'textarea'
  value?: string
  rows?: number
  required?: boolean
}
export interface SelectItem extends ControlBase {
  type: 'select'
  options: (string | { value: string; label?: string })[]
  value?: string
}
export interface ButtonItem extends ControlBase {
  type: 'button'
  text?: string
  variant?: 'primary' | 'danger'
}
export interface ListItem {
  type: 'list'
  items: { label: string; badge?: { text: string; tone?: DashboardTone } }[]
}
export interface TableItem {
  type: 'table'
  columns: string[]
  rows: (string | number)[][]
}

/** 한 행(row)에 담을 수 있는 컨트롤. */
export type ControlItem = ToggleItem | InputItem | TextareaItem | SelectItem | ButtonItem | ListItem | TableItem

/** 행의 왼쪽에 보이는 라벨, 라벨 옆의 부연, 아래의 설명. */
export interface RowLabels {
  label?: string
  meta?: string
  description?: string
}

/** 라벨과 컨트롤 여러 개를 한 줄로 묶는다. */
export interface RowItem extends RowLabels {
  type: 'row'
  items: ControlItem[]
}

/** 컨트롤을 row 없이 바로 쓰면 그 컨트롤 하나만 든 row로 그려진다 (RowLabels를 함께 쓸 수 있다). */
export type ControlRowItem = ControlItem & RowLabels

export interface HeadingItem {
  type: 'heading'
  text: string
  level?: 2 | 3
}
export interface TextItem {
  type: 'text'
  text: string
  muted?: boolean
}
export interface DividerItem {
  type: 'divider'
}
export interface BadgeItem {
  type: 'badge'
  text: string
  tone?: DashboardTone
}
/** 제목이 있는 접이식 묶음. */
export interface SectionItem {
  type: 'section'
  title: string
  description?: string
  /** false면 접힌 채로 보인다. */
  open?: boolean
  items: DashboardItem[]
}

export type DashboardItem = HeadingItem | TextItem | DividerItem | BadgeItem | SectionItem | RowItem | ControlRowItem

/** 화면 하나. */
export interface DashboardPage {
  title: string
  description?: string
  /** 제목 옆의 상태 배지. */
  status?: { text: string; tone?: DashboardTone }
  items: DashboardItem[]
}
