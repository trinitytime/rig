// shortcut: ctx를 Record<string, unknown>으로만 다룬다(변수 타입 검사 없음), 변수가 늘어 오타가 잦아지면 job 제네릭으로 올린다.
export type Ctx = Record<string, unknown>
export type Val<T> = T | ((ctx: Ctx) => T)
export type Task = (ctx: Ctx) => void | Promise<void>
// 처리는 내용(Buffer)만 돌려주거나, 내용과 함께 outDir 아래에 쓸 상대 경로(file)를 돌려준다.
export type Output = Buffer | { content: Buffer; file: string }
export type Processor = (content: Buffer, file: string, ctx: Ctx) => Output | Promise<Output>
export type Job = () => Promise<void>
