import type { PluginHttp, PluginLogger } from "./plugin.js";

type FetchHandler = (req: Request) => Response | Promise<Response>;

/** 코어 자신이 쓰는 /api/ 하위 경로. 이 id의 플러그인은 등록할 수 없다. */
const RESERVED = new Set(["plugins"]);

/** 플러그인이 등록한 fetch 핸들러를 `/api/<id>/*` 로 연결한다. 핸들러는 접두사가 제거된 경로를 받는다. */
export class HttpRouter {
  private handlers = new Map<string, { fn: FetchHandler; log: PluginLogger }>();

  register(id: string, fn: FetchHandler, log: PluginLogger): () => void {
    if (typeof fn !== "function") throw new Error("fetch handler must be a function");
    if (RESERVED.has(id)) throw new Error(`"/api/${id}" is reserved by the core`);
    if (this.handlers.has(id)) throw new Error("fetch handler is already registered");
    const entry = { fn, log };
    this.handlers.set(id, entry);
    return () => {
      if (this.handlers.get(id) === entry) this.handlers.delete(id);
    };
  }

  async handle(id: string, req: Request): Promise<Response> {
    const h = this.handlers.get(id);
    if (!h) return Response.json({ error: "not found" }, { status: 404 });
    const url = new URL(req.url);
    url.pathname = url.pathname.slice(`/api/${id}`.length) || "/";
    try {
      const res = await h.fn(new Request(url, req));
      if (!(res instanceof Response)) throw new Error("fetch handler must return a Response");
      return res;
    } catch (e) {
      h.log.error("fetch handler failed:", e);
      return Response.json({ error: "plugin error" }, { status: 500 });
    }
  }
}

export function createHttp(
  router: HttpRouter,
  id: string,
  track: (dispose: () => void) => () => void,
  log: PluginLogger,
): PluginHttp {
  const http: PluginHttp = { fetch: (fn) => track(router.register(id, fn, log)) };
  return Object.freeze(http);
}
