/** shared "tray:menu" 공간에 쓰는 값: 시스템 트레이 메뉴의 항목 하나. */
export interface TrayItem {
  /** 항목 식별자. */
  id: string
  /** 메뉴에 보이는 이름. */
  name: string
  /** 항목을 누르면 발행되는 신호 이름. */
  signal: string
  /** 정렬 순서(작을수록 위). 이웃한 항목의 차이가 100 이상이면 그 사이에 구분선이 들어간다. */
  order: number
}
