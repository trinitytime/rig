import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { discoverPlugins, type DiscoveredPlugin } from './discovery.ts'
import { rigHome } from '../paths.ts'
import type { InstalledPlugins } from './registry.ts'
import type { PluginCleanup, PluginContext, PluginLogger, RigPlugin } from './plugin.ts'
import { createHttp, HttpRouter } from '../ctx/http.ts'
import { createSignal, SignalBus } from '../ctx/signal.ts'
import { createShared, SharedMemory } from '../ctx/shared.ts'
import { createStorage } from '../ctx/storage.ts'
import { createTimer } from '../ctx/timer.ts'
import { Ownership, type Track } from '../ctx/ownership.ts'
import { createService, ServiceRegistry } from '../ctx/services.ts'

export type PluginState = 'active' | 'failed' | 'skipped'

export interface PluginStatus {
  id: string
  name: string
  source: DiscoveredPlugin['source'] | 'unknown'
  state: PluginState
  requires: string[]
  error?: string
}

export class PluginLoader {
  readonly services = new ServiceRegistry()
  /** 코어가 신호를 보낼 때도 이 버스를 쓴다. */
  readonly signals = new SignalBus()
  /** 플러그인의 웹 API. 서버가 /<id>/* 를 여기로 보낸다. */
  readonly http = new HttpRouter()
  /** 플러그인 간 공유 값. 코어는 config 워크스페이스의 설정(allowedHosts 등)을 여기서 읽는다. */
  readonly shared = new SharedMemory((signal, payload) => this.signals.emit(signal, payload))
  private owned = new Ownership()
  private statuses: PluginStatus[] = []
  private cleanups = new Map<string, PluginCleanup | undefined>()
  private order: string[] = []

  list(): PluginStatus[] {
    return this.statuses
  }

  /** 설치 목록에서 활성화된 것만 탐색 → requires 기준 위상 정렬 → 순서대로 import & activate. 한 플러그인의 실패가 다른 플러그인을 막지 않는다. */
  async loadAll(installed: InstalledPlugins): Promise<PluginStatus[]> {
    const on = new Set(installed.filter((i) => i.enabled).map((i) => i.id))
    const found = discoverPlugins(installed.flatMap((i) => (i.source === 'custom' ? [i.path] : [])))
    const { errors } = found
    const plugins = found.plugins.filter((p) => on.has(p.manifest.id))
    this.statuses = errors.map((e) => ({
      id: path.basename(e.dir),
      name: path.basename(e.dir),
      source: 'unknown',
      state: 'failed',
      requires: [],
      error: e.error,
    }))

    const byId = new Map(plugins.map((p) => [p.manifest.id, p]))
    const sorted: DiscoveredPlugin[] = []
    const mark = new Map<string, 'visiting' | 'done'>()
    const failed = new Map<string, string>() // id -> 사유

    const visit = (p: DiscoveredPlugin, chain: string[]): void => {
      const id = p.manifest.id
      if (mark.get(id) === 'done') return
      if (mark.get(id) === 'visiting') {
        failed.set(id, `circular requires: ${[...chain, id].join(' -> ')}`)
        return
      }
      mark.set(id, 'visiting')
      for (const dep of p.manifest.requires ?? []) {
        const d = byId.get(dep)
        if (!d) failed.set(id, `required plugin "${dep}" not found`)
        else {
          visit(d, [...chain, id])
          if (failed.has(dep)) failed.set(id, `required plugin "${dep}" unavailable`)
        }
      }
      mark.set(id, 'done')
      if (!failed.has(id)) sorted.push(p)
    }
    plugins.forEach((p) => visit(p, []))

    for (const [id, error] of failed) this.statuses.push(this.skipped(byId.get(id)!, error))

    // 로드에 실패했거나 건너뛴 플러그인에 의존하는 플러그인은 올리지 않는다.
    const down = new Set(failed.keys())
    for (const p of sorted) {
      const dead = (p.manifest.requires ?? []).find((dep) => down.has(dep))
      const status = dead ? this.skipped(p, `required plugin "${dead}" unavailable`) : await this.activate(p)
      if (status.state !== 'active') down.add(p.manifest.id)
      this.statuses.push(status)
    }
    return this.statuses
  }

  private skipped(p: DiscoveredPlugin, error: string): PluginStatus {
    return {
      id: p.manifest.id,
      name: p.manifest.name,
      source: p.source,
      state: 'skipped',
      requires: p.manifest.requires ?? [],
      error,
    }
  }

  private async activate(p: DiscoveredPlugin): Promise<PluginStatus> {
    const { id } = p.manifest
    const requires = p.manifest.requires ?? []
    const status: PluginStatus = { id, name: p.manifest.name, source: p.source, state: 'active', requires }
    if (!p.entry) return status // UI 전용 플러그인
    try {
      if (!fs.existsSync(p.entry)) throw new Error(`entry not found: ${p.entry}`)
      const mod = await import(pathToFileURL(p.entry).href)
      const plugin: RigPlugin = mod.default
      if (typeof plugin !== 'function') throw new Error('entry must default-export a function (ctx) => ...')

      const ctx = this.createContext(id, requires)
      this.owned.open(id)
      const cleanup = await plugin(ctx)
      this.cleanups.set(id, typeof cleanup === 'function' ? cleanup : undefined)
      this.order.push(id)
    } catch (e) {
      this.owned.release(id)
      status.state = 'failed'
      status.error = e instanceof Error ? e.message : String(e)
      console.error(`[rig] plugin "${id}" failed:`, status.error)
    }
    return status
  }

  private createContext(id: string, requires: string[]): PluginContext {
    const tag = `[${id}]`
    const log: PluginLogger = {
      info: (...a) => console.log(tag, ...a),
      warn: (...a) => console.warn(tag, ...a),
      error: (...a) => console.error(tag, ...a),
    }
    const dataDir = path.join(rigHome(), 'data', id)
    fs.mkdirSync(dataDir, { recursive: true })
    // id는 클로저로만 존재한다. ctx에는 id를 읽을 수 있는 속성이 없다.
    const track: Track = (dispose, first) => this.owned.track(id, dispose, first)
    return Object.freeze({
      log: Object.freeze(log),
      dataDir,
      timer: createTimer(track, log),
      signal: createSignal(this.signals, track, log),
      http: createHttp(this.http, id, track, log),
      shared: createShared(this.shared, id, track),
      storage: createStorage(dataDir),
      service: createService(this.services, id, requires, track),
    })
  }

  /** 로드의 역순으로 deactivate. */
  async unloadAll(): Promise<void> {
    for (const id of [...this.order].reverse()) {
      try {
        await this.cleanups.get(id)?.()
      } catch (e) {
        console.error(`[rig] plugin "${id}" deactivate failed:`, e)
      }
      this.owned.release(id)
    }
    this.cleanups.clear()
    this.order = []
  }
}
