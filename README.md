# Bunny Reader Pet

Windows 桌面兔女郎桌宠。当前版本保留小说阅读条和托盘菜单，同时加入新的自动行为调度：

- 70% 时间在角落或屏幕边缘安静休息
- 10% 时间在屏幕内走动或跑动
- 10% 时间短暂消失到屏幕外
- 10% 时间从屏幕边缘突然串出来
- 支持鼠标拖动，拖动中和松手后会切换专用动画

## Scripts

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

PowerShell 可能会拦截 `npm.ps1`，所以优先使用 `npm.cmd`。

## Pet Assets

运行时动画帧放在：

```text
public/pet/animations/<state>/<frame>.png
```

每个 PNG 是 `236x342` 透明画布。帧列表、帧率、循环方式和命中区域在 `public/pet/manifest.json` 里配置。

当前核心状态包括：

```text
idle
rest_corner
walk_left / walk_right / walk_up / walk_down
run_left / run_right / run_up / run_down
drag_hold / drag_release
peek_left / peek_right
hide
popout_left / popout_right / popout_top / popout_bottom
read_idle
tap_happy / tap_annoyed
```
