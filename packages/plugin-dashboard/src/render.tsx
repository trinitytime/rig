/** @jsxImportSource hono/jsx */
import { Page } from './components/page/Page.tsx'
import { Side, pageList } from './components/side/Side.tsx'
import { obj, str, type Obj } from './components/util.ts'

export const Shell = ({ base, space, current }: { base: string; space: Obj; current?: string }) => {
  const pages = pageList(space)
  const key = pages.find((p) => p.key === current)?.key ?? pages[0]?.key
  const page = key ? obj(space[key]) : {}
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{key ? `${str(page.title) || key} — Rig` : 'Rig'}</title>
        <link rel="stylesheet" href={`${base}rig-ui.css`} />
      </head>
      <body class="rig-shell" data-page={key} data-base={base}>
        <Side base={base} pages={pages} current={key} />
        <Page pageKey={key} page={page} />
        <script src={`${base}client.js`} defer></script>
      </body>
    </html>
  )
}
