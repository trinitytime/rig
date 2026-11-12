# rig icons (2c · unified slot)

Colors: ink #1c1c1a · paper #f2f0ea · accent #e8622a
Glyph: 24-grid for ≥48px, hinted 16-grid for ≤32px.

> Note: files named `*-2x.png` / `*-3x.png` must be renamed to `@2x` / `@3x` before use (macOS iconset and tray template naming).

## Web
```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```
favicon.svg switches to the paper color in dark mode.

## macOS
Rename `-2x` → `@2x`, then `iconutil -c icns macos/rig.iconset` → rig.icns (Apple grid: 824px body in a 1024 canvas).
Tray: `tray/macos/rigTemplate.png` (+@2x/@3x). Template image; the OS tints it.

## Windows
App: `windows/rig.ico` (16–256). Tray: `rig-tray-light.ico` / `rig-tray-dark.ico` by taskbar theme; `accent` PNGs for an attention/active state.

## Linux
Copy `linux/<size>/rig.png` to `hicolor/<size>/apps/`. Tray: `tray/linux`; symbolic SVG for GNOME.

## Sources
`svg/` holds the master glyphs (color + mono, 24 and 16 grid) and the app icon.
