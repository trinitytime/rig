import type { MiddlewareHandler } from "hono";
import { z } from "zod";

/** 코어가 shared에 값을 쓸 때의 소유자. 플러그인 id 규칙(영문자, 숫자, -, _)에 없는 문자라 플러그인과 겹치지 않는다. */
export const CORE_OWNER = "$core";
/** 허용 호스트의 기본값. shared의 config 워크스페이스, allowedHosts key에 저장된다 (코어만 바꿀 수 있음). */
export const DEFAULT_ALLOWED_HOSTS = ["127.0.0.1", "localhost"];

const allowedHostsSchema = z.array(z.string().min(1)).catch(DEFAULT_ALLOWED_HOSTS);
export const parseAllowedHosts = (v: unknown): string[] => allowedHostsSchema.parse(v ?? DEFAULT_ALLOWED_HOSTS);

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
