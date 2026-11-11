import { chmodSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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
  // systray2의 chmod('+x')가 실패해도 조용히 넘어가(특히 Bun) 실행 권한 없이 spawn되므로 직접 준다.
  if (process.platform !== "win32") {
    const bin = join(dirname(createRequire(import.meta.url).resolve("systray2")), "traybin", `tray_${process.platform === "darwin" ? "darwin" : "linux"}_release`);
    chmodSync(bin, 0o755);
  }
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
  await tray.ready(); // 프로세스가 뜬 뒤에야 이벤트를 붙일 수 있다.
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
