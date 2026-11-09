import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { discoverPlugins, type DiscoveredPlugin } from "./discovery.js";
import { rigHome } from "./paths.js";
import type { PluginContext, PluginLogger, RigPlugin } from "./plugin.js";
import { ServiceRegistry } from "./services.js";

export type PluginState = "active" | "failed" | "skipped";

export interface PluginStatus {
  name: string;
  source: DiscoveredPlugin["source"] | "unknown";
  state: PluginState;
  requires: string[];
  error?: string;
}

export class PluginLoader {
  readonly services = new ServiceRegistry();
  private statuses: PluginStatus[] = [];
  private active = new Map<string, RigPlugin>();
  private order: string[] = [];

  list(): PluginStatus[] {
    return this.statuses;
  }

  /** 탐색 → requires 기준 위상 정렬 → 순서대로 import & activate. 한 플러그인의 실패가 다른 플러그인을 막지 않는다. */
  async loadAll(): Promise<PluginStatus[]> {
    const { plugins, errors } = discoverPlugins();
    this.statuses = errors.map((e) => ({
      name: path.basename(e.dir),
      source: "unknown",
      state: "failed",
      requires: [],
      error: e.error,
    }));

    const byName = new Map(plugins.map((p) => [p.manifest.name, p]));
    const sorted: DiscoveredPlugin[] = [];
    const mark = new Map<string, "visiting" | "done">();
    const failed = new Map<string, string>(); // name -> 사유

    const visit = (p: DiscoveredPlugin, chain: string[]): void => {
      const name = p.manifest.name;
      if (mark.get(name) === "done") return;
      if (mark.get(name) === "visiting") {
        failed.set(name, `circular requires: ${[...chain, name].join(" -> ")}`);
        return;
      }
      mark.set(name, "visiting");
      for (const dep of p.manifest.requires ?? []) {
        const d = byName.get(dep);
        if (!d) failed.set(name, `required plugin "${dep}" not found`);
        else {
          visit(d, [...chain, name]);
          if (failed.has(dep)) failed.set(name, `required plugin "${dep}" unavailable`);
        }
      }
      mark.set(name, "done");
      if (!failed.has(name)) sorted.push(p);
    };
    plugins.forEach((p) => visit(p, []));

    for (const [name, error] of failed) {
      const p = byName.get(name)!;
      this.statuses.push({ name, source: p.source, state: "skipped", requires: p.manifest.requires ?? [], error });
    }
    for (const p of sorted) this.statuses.push(await this.activate(p));
    return this.statuses;
  }

  private async activate(p: DiscoveredPlugin): Promise<PluginStatus> {
    const { name } = p.manifest;
    const requires = p.manifest.requires ?? [];
    const status: PluginStatus = { name, source: p.source, state: "active", requires };
    if (!p.entry) return status; // UI 전용 플러그인
    try {
      if (!fs.existsSync(p.entry)) throw new Error(`backend not built: ${p.entry}`);
      const mod = await import(pathToFileURL(p.entry).href);
      const plugin: RigPlugin = mod.default ?? mod;
      if (typeof plugin?.activate !== "function") throw new Error("backend must default-export { activate }");

      const tag = `[${name}]`;
      const log: PluginLogger = {
        info: (...a) => console.log(tag, ...a),
        warn: (...a) => console.warn(tag, ...a),
        error: (...a) => console.error(tag, ...a),
      };
      const dataDir = path.join(rigHome(), "data", name);
      fs.mkdirSync(dataDir, { recursive: true });
      const ctx: PluginContext = {
        name,
        log,
        dataDir,
        services: {
          provide: (impl) => this.services.provide(name, name, impl),
          get: (svc) => {
            if (!requires.includes(svc)) throw new Error(`"${name}" did not declare "${svc}" in requires`);
            return this.services.get(svc);
          },
        },
      };
      await plugin.activate(ctx);
      this.active.set(name, plugin);
      this.order.push(name);
    } catch (e) {
      this.services.removeOwner(name);
      status.state = "failed";
      status.error = e instanceof Error ? e.message : String(e);
      console.error(`[rig] plugin "${name}" failed:`, status.error);
    }
    return status;
  }

  /** 로드의 역순으로 deactivate. */
  async unloadAll(): Promise<void> {
    for (const name of [...this.order].reverse()) {
      try {
        await this.active.get(name)?.deactivate?.();
      } catch (e) {
        console.error(`[rig] plugin "${name}" deactivate failed:`, e);
      }
      this.services.removeOwner(name);
    }
    this.active.clear();
    this.order = [];
  }
}
