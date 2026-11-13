// 선언형 화면 JSON은 모두 외부 입력이라, 값을 안전한 형태로 바꾸는 헬퍼를 둔다.
export type Obj = Record<string, unknown>
export const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
export const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
export const opt = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : String(v))

/** 컨트롤 하나가 공통으로 쓰는 값. id는 화면 안 위치(k)에서 만들고, ev는 이벤트 id다(없으면 읽기 전용처럼 동작한다). */
export const controlProps = (it: Obj, k: string) => {
  const id = `c-${k.replace(/\./g, '-')}`
  return {
    id,
    ev: opt(it.id),
    disabled: it.disabled === true,
    invalid: it.error ? { 'aria-invalid': 'true', 'aria-describedby': `${id}-err` } : {},
  }
}

export type ItemProps = { it: Obj; k: string }
