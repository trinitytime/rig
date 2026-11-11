import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { PluginLoader } from "./plugin/loader.ts";
import { hostGuard, parseAllowedHosts } from "./security.ts";

/** 기본 포트. 전화 키패드로 R-I-G = 7-4-4 (+0). 흔한 개발 포트(3000/5173/8080)와 겹치지 않음. */
export const DEFAULT_PORT = 7440;
/** 보안상 로컬 루프백에만 바인딩한다. */
export const DEFAULT_HOST = "127.0.0.1";

export function createApp(loader?: PluginLoader, opts: { port?: number } = {}): Hono {
  const app = new Hono();
  // 허용 호스트는 shared의 config/allowedHosts에서 요청마다 읽는다.
  app.use("*", hostGuard(() => parseAllowedHosts(loader?.shared.get("config", "allowedHosts")), opts.port));
  app.get("/", (c) => c.html("<!doctype html><title>Rig</title><div id=\"rig-shell\"></div>"));
  app.get("/health", (c) => c.json({ ok: true, name: "rig", apiVersion: 1 }));
  app.get("/api/plugins", (c) => c.json(loader?.list() ?? []));
  if (loader) app.all("/api/:plugin/*", (c) => loader.http.handle(c.req.param("plugin"), c.req.raw));
  return app;
}

export interface StartServerOptions {
  loader?: PluginLoader;
  port?: number;
  host?: string;
}

/** Bun 런타임 전역(bun-types 없이 쓰는 최소 선언). */
declare const Bun: {
  serve(o: { fetch: (r: Request) => Response | Promise<Response>; port: number; hostname: string }): {
    port: number;
    stop(): void;
  };
};

export function startServer(opts: StartServerOptions = {}): { close(): void } {
  const port = opts.port ?? Number(process.env.RIG_PORT ?? DEFAULT_PORT);
  const hostname = opts.host ?? DEFAULT_HOST;
  const { fetch } = createApp(opts.loader, { port });
  const log = (p: number) => console.log(`Rig listening on http://${hostname}:${p}`);

  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
    const server = Bun.serve({ fetch, port, hostname });
    log(server.port);
    return { close: () => server.stop() };
  }
  return serve({ fetch, port, hostname }, (info) => log(info.port));
}
