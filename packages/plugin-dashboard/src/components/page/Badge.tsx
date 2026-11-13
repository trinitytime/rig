/** @jsxImportSource hono/jsx */
import { str, type Obj } from '../util.ts'

const tone = (v: unknown) => (['success', 'warning', 'danger'].includes(str(v)) ? ` rig-badge--${str(v)}` : '')

export const Badge = ({ b }: { b: Obj }) => <span class={`rig-badge${tone(b.tone)}`}>{str(b.text)}</span>
