/** @jsxImportSource hono/jsx */
import { str, type ItemProps } from './util.ts'

export const Heading = ({ it, k }: ItemProps) =>
  it.level === 3 ? (
    <h3 class="rig-heading" data-k={k}>
      {str(it.text)}
    </h3>
  ) : (
    <h2 class="rig-heading" data-k={k}>
      {str(it.text)}
    </h2>
  )

export const Text = ({ it, k }: ItemProps) => (
  <p class={`rig-text${it.muted ? ' rig-text--muted' : ''}`} data-k={k}>
    {str(it.text)}
  </p>
)

export const Divider = ({ k }: { k: string }) => <hr class="rig-divider" data-k={k} />
