import type { MiddlewareHandler } from "hono";
import { z } from "zod";

/** 허용 호스트의 기본값. 항상 허용된다. */
export const DEFAULT_ALLOWED_HOSTS = ["127.0.0.1", "localhost"];

const extraHostsSchema = z.array(z.string().min(1));
/** 기본값에 shared의 config/allowedHosts 값(있고 올바르면)을 합친다. 값이 있는데 잘못되었으면 무시하고 warn으로 알린다. */
export function mergeAllowedHosts(extra: unknown, warn: (message: string) => void = () => {}): string[] {
  let hosts: string[] = [];
  if (extra !== undefined) {
    const r = extraHostsSchema.safeParse(extra);
    if (r.success) hosts = r.data;
    else warn('shared "config/allowedHosts" must be a string array; ignored');
  }
  return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...hosts])];
}

const parse = (s: string): URL | undefined => {
  try {
    return new URL(s);
  } catch {
    return undefined;
  }
};

/**
 * 다른 웹사이트가 사용자의 브라우저를 통해 로컬 서버를 호출하는 것을 막는다.
 *  - Host: DNS rebinding 방어. 허용 호스트(+서버 포트)가 아니면 403.
 *  - Origin: 다른 사이트에서 온 요청 방어. 있는데 허용 목록(http, 같은 포트)이 아니면 403. 없으면(curl 등) 통과.
 *  - Sec-Fetch-Site: cross-site면 403.
 */
export function hostGuard(getAllowed: () => string[], port?: number): MiddlewareHandler {
  const ok = (u: URL | undefined, allowed: string[]) =>
    !!u && allowed.includes(u.hostname) && (port === undefined || u.port === String(port));
  return async (c, next) => {
    const allowed = getAllowed();
    const deny = (why: string) => c.json({ error: `forbidden ${why}` }, 403);
    if (!ok(parse(`http://${c.req.header("host") ?? ""}`), allowed)) return deny("host");
    const origin = c.req.header("origin");
    if (origin !== undefined) {
      const u = parse(origin);
      if (!(u?.protocol === "http:" && ok(u, allowed))) return deny("origin");
    }
    if (c.req.header("sec-fetch-site") === "cross-site") return deny("site");
    await next();
  };
}
