/** @jsxImportSource hono/jsx */
import type { Child } from "hono/jsx";

// 선언형 화면 JSON(shared "ui" 공간의 값)을 HTML로 그린다. 값은 모두 외부 입력이라 문자열로 바꿔 쓰고, hono가 이스케이프한다.
// shortcut: 스키마를 zod로 검증하지 않고 모르는 type은 건너뛴다, 플러그인이 늘어 오류 안내가 필요해지면 검증을 추가.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const opt = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : String(v));
const tone = (v: unknown) => (["success", "warning", "danger"].includes(str(v)) ? ` rig-badge--${str(v)}` : "");

const Badge = ({ b }: { b: Obj }) => <span class={`rig-badge${tone(b.tone)}`}>{str(b.text)}</span>;

type RowProps = { k: string; it: Obj; block?: boolean; labelFor?: string; children: Child };
const Row = ({ k, it, block, labelFor, children }: RowProps) => (
  <div class={`rig-row${block ? " rig-row--block" : ""}`} data-k={k}>
    <div class="rig-row-info">
      {labelFor ? <label class="rig-row-label" for={labelFor}>{str(it.label)}</label> : <span class="rig-row-label">{str(it.label)}</span>}
      {it.description ? <p class="rig-row-desc">{str(it.description)}</p> : null}
    </div>
    <div class="rig-row-control">{children}</div>
  </div>
);

/** 입력 하나를 오류 문구와 함께 감싼다. error가 없으면 그대로 둔다. */
const Field = ({ id, it, children }: { id: string; it: Obj; children: Child }) =>
  it.error ? (
    <div class="rig-field">
      {children}
      <p class="rig-error" id={`${id}-err`}>{str(it.error)}</p>
    </div>
  ) : (
    <>{children}</>
  );

const Item = ({ it: raw, k }: { it: unknown; k: string }) => {
  const it = obj(raw);
  const id = `c-${k.replace(/\./g, "-")}`;
  const ev = opt(it.id); // 이벤트 id. 없으면 읽기 전용처럼 동작한다.
  const invalid = it.error ? { "aria-invalid": "true", "aria-describedby": `${id}-err` } : {};
  const disabled = it.disabled === true;

  switch (it.type) {
    case "heading":
      return it.level === 3 ? <h3 class="rig-heading" data-k={k}>{str(it.text)}</h3> : <h2 class="rig-heading" data-k={k}>{str(it.text)}</h2>;
    case "text":
      return <p class={`rig-text${it.muted ? " rig-text--muted" : ""}`} data-k={k}>{str(it.text)}</p>;
    case "divider":
      return <hr class="rig-divider" data-k={k} />;
    case "badge":
      return <span data-k={k}><Badge b={it} /></span>;
    case "section":
      return (
        <details class="rig-section" open={it.open !== false}>
          <summary>{str(it.title)}</summary>
          {it.description ? <p class="rig-section-desc">{str(it.description)}</p> : null}
          {arr(it.items).map((c, i) => <Item it={c} k={`${k}.${i}`} />)}
        </details>
      );
    case "toggle":
      return (
        <Row k={k} it={it} labelFor={id}>
          <Field id={id} it={it}>
            <input class="rig-toggle" type="checkbox" role="switch" id={id} data-ev={ev} checked={it.value === true} disabled={disabled} {...invalid} />
          </Field>
        </Row>
      );
    case "input": {
      const type = ["number", "password"].includes(str(it.inputType)) ? str(it.inputType) : "text";
      return (
        <Row k={k} it={it} labelFor={id}>
          <Field id={id} it={it}>
            <input class="rig-input" type={type} id={id} data-ev={ev} value={opt(it.value)} placeholder={opt(it.placeholder)}
              min={opt(it.min)} max={opt(it.max)} pattern={opt(it.pattern)} required={it.required === true} disabled={disabled} {...invalid} />
          </Field>
        </Row>
      );
    }
    case "textarea":
      return (
        <Row k={k} it={it} block labelFor={id}>
          <Field id={id} it={it}>
            <textarea class="rig-textarea" id={id} data-ev={ev} rows={Number(it.rows) || 3} required={it.required === true} disabled={disabled} {...invalid}>{str(it.value)}</textarea>
          </Field>
        </Row>
      );
    case "select":
      return (
        <Row k={k} it={it} labelFor={id}>
          <Field id={id} it={it}>
            <select class="rig-select" id={id} data-ev={ev} disabled={disabled} {...invalid}>
              {arr(it.options).map((o) => {
                const { value, label } = typeof o === "object" ? obj(o) : { value: o, label: o };
                return <option value={str(value)} selected={str(value) === str(it.value)}>{str(label ?? value)}</option>;
              })}
            </select>
          </Field>
        </Row>
      );
    case "button":
      return (
        <Row k={k} it={it}>
          <button class={`rig-button${["primary", "danger"].includes(str(it.variant)) ? ` rig-button--${str(it.variant)}` : ""}`} type="button" data-ev={ev} disabled={disabled}>
            {str(it.text ?? it.label)}
          </button>
        </Row>
      );
    case "list":
      return (
        <Row k={k} it={it} block>
          <ul class="rig-list">
            {arr(it.items).map((r) => {
              const row = obj(r);
              return <li><span>{str(row.label)}</span>{row.badge ? <Badge b={obj(row.badge)} /> : null}</li>;
            })}
          </ul>
        </Row>
      );
    case "table":
      return (
        <Row k={k} it={it} block>
          <div class="rig-table-wrap">
            <table class="rig-table">
              <thead><tr>{arr(it.columns).map((c) => <th scope="col">{str(c)}</th>)}</tr></thead>
              <tbody>
                {arr(it.rows).map((r) => <tr>{arr(r).map((c) => <td class={typeof c === "number" ? "rig-num" : undefined}>{str(c)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </Row>
      );
    default:
      return null;
  }
};

export type PageEntry = { key: string; title: string };

/** shared "ui" 공간에서 화면 목록을 뽑는다. items 배열이 있는 값만 화면으로 본다. */
export function pageList(space: Obj): PageEntry[] {
  return Object.entries(space)
    .filter(([, v]) => Array.isArray(obj(v).items))
    .map(([key, v]) => ({ key, title: str(obj(v).title) || key }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export const Shell = ({ base, space, current }: { base: string; space: Obj; current?: string }) => {
  const pages = pageList(space);
  const key = pages.find((p) => p.key === current)?.key ?? pages[0]?.key;
  const page = key ? obj(space[key]) : {};
  const status = obj(page.status);
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{key ? `${str(page.title) || key} — Rig` : "Rig"}</title>
        <link rel="stylesheet" href={`${base}rig-ui.css`} />
      </head>
      <body class="rig-shell" data-page={key} data-base={base}>
        <aside class="rig-side">
          <h2 class="rig-side-title">Rig</h2>
          <nav aria-label="화면 목록">
            <ul class="rig-nav-list">
              {pages.map((p) => (
                <li><a class="rig-nav-item" href={`${base}?p=${encodeURIComponent(p.key)}`} aria-current={p.key === key ? "page" : undefined}>{p.title}</a></li>
              ))}
            </ul>
          </nav>
        </aside>
        <main class="rig-page">
          {key ? (
            <>
              <header data-k="h" style="display:grid;gap:4px">
                <div class="rig-actions" style="justify-content:space-between;align-items:center">
                  <h1 class="rig-heading">{str(page.title) || key}</h1>
                  {status.text ? <Badge b={status} /> : null}
                </div>
                {page.description ? <p class="rig-text rig-text--muted">{str(page.description)}</p> : null}
              </header>
              {arr(page.items).map((it, i) => <Item it={it} k={String(i)} />)}
            </>
          ) : (
            <p class="rig-text rig-text--muted" data-k="empty">표시할 화면이 없습니다.</p>
          )}
        </main>
        <script src={`${base}client.js`} defer></script>
      </body>
    </html>
  );
};
