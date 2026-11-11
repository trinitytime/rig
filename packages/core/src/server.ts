import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { PluginLoader } from "./plugin/loader.ts";
import { z } from "zod";
import { hostGuard, mergeAllowedHosts } from "./security.ts";

/** 기본 포트. 전화 키패드로 R-I-G = 7-4-4 (+0). 흔한 개발 포트(3000/5173/8080)와 겹치지 않음. */
export const DEFAULT_PORT = 7440;
/** 보안상 로컬 루프백에만 바인딩한다. */
export const DEFAULT_HOST = "127.0.0.1";

const portSchema = z.coerce.number().int().min(1).max(65535);

/** RIG_PORT(없으면 기본 포트)를 검증한다. 잘못된 값이면 이유와 함께 던진다 (NaN이면 모든 요청이 403이 되어 원인을 찾기 어렵다). */
export function resolvePort(env: string | undefined = process.env.RIG_PORT): number {
  const r = portSchema.safeParse(env ?? DEFAULT_PORT);
  if (!r.success) throw new Error(`RIG_PORT must be an integer from 1 to 65535 (got "${env}")`);
  return r.data;
}

export function createApp(loader?: PluginLoader, opts: { port?: number } = {}): Hono {
  const app = new Hono();
  // 허용 호스트: 기본값 + shared의 config/allowedHosts. 요청마다 읽지 않고, 시작할 때와 shared:config 신호가 올 때만 다시 계산한다.
  let allowed = mergeAllowedHosts(undefined);
  const refresh = () => void (allowed = mergeAllowedHosts(loader?.shared.get("config", "allowedHosts")));
  refresh();
  loader?.signals.on("shared:config", refresh, console);
  app.use("*", hostGuard(() => allowed, opts.port));
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
  const port = opts.port ?? resolvePort();
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
