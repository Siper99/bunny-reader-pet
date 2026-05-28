# Bunny Reader Pet

一个 Windows 桌面摸鱼小宠物 MVP：透明置顶兔女郎桌宠、随机走动、点击反应、右键菜单，以及拖入小说网址后的单行阅读浮条。

兔女郎本体可以左键按住拖动到屏幕内任意位置；单击仍会触发互动反应。

## Scripts

- `npm.cmd install` 安装依赖
- `npm.cmd run dev` 启动 Electron 开发版
- `npm.cmd test` 运行单元测试
- `npm.cmd run build` 类型检查并构建

Windows PowerShell 可能会拦截 `npm.ps1`，所以命令里优先使用 `npm.cmd`。

## Pet Assets

首版动画素材约定放在：

```text
public/pet/animations/<state>/<frame>.png
```

动作状态：

- `idle`
- `walk_left`
- `walk_right`
- `enter`
- `exit`
- `tap_happy`
- `tap_annoyed`
- `read_idle`

每个动作的帧列表、帧率、循环方式和命中区域在 `public/pet/manifest.json` 配置。开发期即使没有 PNG，应用也会显示一个 CSS 占位兔子，方便先验证交互和状态机。
