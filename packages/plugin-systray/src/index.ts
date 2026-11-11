import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RigPlugin } from "@rig/core";
import * as mod from "systray2";
import type SysTrayType from "systray2";
import type { MenuItem } from "systray2";

// systray2는 CJS라 ESM에서는 default가 한 겹 더 감싸질 수 있다.
const m: any = mod;
const SysTray: typeof SysTrayType.default = m.default?.default ?? m.default ?? m;

type TrayItem = { id: string; name: string; signal: string; order: number };

const isTrayItem = (v: unknown): v is TrayItem => {
  const t = v as TrayItem;
  return !!t && typeof t.id === "string" && typeof t.name === "string" && typeof t.signal === "string" && typeof t.order === "number";
};

// shortcut: Windows는 어두운 작업 표시줄용(dark) 아이콘만 쓴다, 테마 감지가 필요하면 light.ico와 전환.
const trayIcons = { win32: "windows/rig-tray-dark.ico", darwin: "macos/rigTemplate-2x.png", linux: "linux/rig-tray-22.png" } as Record<string, string>;
const iconFile = trayIcons[process.platform] ?? trayIcons.linux!;
const icon = readFileSync(join(import.meta.dirname, "../../../assets/rig-icons/tray", iconFile)).toString("base64");

const plugin: RigPlugin = async (ctx) => {
  const signals = new Map<MenuItem, string>();

  const build = async () => {
    const space = await ctx.shared.get("tray");
    signals.clear();
    const items = Object.values(space)
      .filter((v): v is TrayItem => {
        if (!isTrayItem(v)) ctx.log.warn("ignored invalid tray value:", v);
        return isTrayItem(v);
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map((t) => {
        const item: MenuItem = { title: t.name, tooltip: t.name, enabled: true };
        signals.set(item, t.signal);
        return item;
      });
    return { icon, isTemplateIcon: process.platform === "darwin", title: "", tooltip: "rig", items };
  };

  const tray = new SysTray({ menu: await build() });
  tray.onError((e) => ctx.log.error("systray failed:", e));
  void tray.onClick(({ item }) => {
    const signal = signals.get(item);
    if (!signal) return;
    try {
      ctx.signal.emit(signal);
    } catch (e) {
      ctx.log.error(`cannot emit "${signal}":`, e);
    }
  });

  // shortcut: 변경마다 메뉴 전체를 다시 만든다, tray 항목이 수백 개로 늘면 디바운스.
  ctx.signal.on("shared:tray", async () => {
    await tray.sendAction({ type: "update-menu", menu: await build() });
  });

  return () => void tray.kill(false);
};
export default plugin;
