import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";

/** 기본 포트. 전화 키패드로 R-I-G = 7-4-4 (+0). 흔한 개발 포트(3000/5173/8080)와 겹치지 않음. */
export const DEFAULT_PORT = 7440;
/** 보안상 로컬 루프백에만 바인딩한다. */
export const DEFAULT_HOST = "127.0.0.1";

export function createApp(): Hono {
  const app = new Hono();
  app.get("/", (c) => c.html("<!doctype html><title>Rig</title><div id=\"rig-shell\"></div>"));
  app.get("/health", (c) => c.json({ ok: true, name: "rig", apiVersion: 1 }));
  return app;
}

export interface StartServerOptions {
  port?: number;
  host?: string;
}

export function startServer(opts: StartServerOptions = {}): ServerType {
  const port = opts.port ?? Number(process.env.RIG_PORT ?? DEFAULT_PORT);
  const hostname = opts.host ?? DEFAULT_HOST;
  const server = serve({ fetch: createApp().fetch, port, hostname }, (info) => {
    console.log(`Rig listening on http://${hostname}:${info.port}`);
  });
  return server;
}
