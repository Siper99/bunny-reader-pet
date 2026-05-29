# CLAUDE.md

This file gives Claude Code working context for this repository.

## Project

**Bunny Reader Pet** is a Windows desktop pet built with Electron, Vite, React, and TypeScript. It creates a transparent always-on-top bunny mascot window that can roam, rest, hide, be grabbed, be thrown with simple physics, and show a one-line novel reader strip.

## Commands

Use `npm.cmd` / `npx.cmd` on Windows PowerShell to avoid `.ps1` execution-policy issues.

```bash
npm.cmd run dev
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Run one test file:

```bash
npm.cmd exec vitest run src/shared/petHitbox.test.ts
```

## Architecture

The app follows the electron-vite layout:

```text
src/
  main/      Electron main process
  preload/   contextBridge API
  renderer/  React UI and DOM measurement
  shared/    pure TypeScript helpers and tests
```

## Main Process

`src/main/main.ts` owns the Electron window, IPC, click-through behavior, and drag session.

Important interaction rules:

- The transparent window starts as click-through with `setIgnoreMouseEvents(true)`.
- The main process polls the real cursor and only disables click-through when the cursor is inside the renderer-reported grab area.
- The grab area is not hard-coded. The renderer sends `pet:update-grab-area` with a live window-local rectangle.
- `pet:start-drag` validates the current pointer against that live grab area before starting a drag.
- Drag stores a `grabOffset` from the window origin to the click point. During dragging, the window moves to `mouseScreenPosition - grabOffset`, so the pet does not snap its center to the cursor.
- Drag clamping uses that same grab offset as the anchor so the grabbed point stays on-screen while the transparent window may overflow.

`src/main/motionController.ts` owns autonomous behavior and physics:

- Modes include rest, roam, hidden, popout/entering, exiting, drag, thrown, and fallen.
- Throws run on a dedicated 16 ms physics timer using `stepProjectile` from `src/shared/throwPhysics.ts`.
- Starting a new drag stops any active throw physics and clears fall/get-up timers.
- After a thrown pet lands, it plays fall/get-up states and then idles briefly before returning to random behavior.
- Tray hide/show uses smooth edge exit/entry instead of instant vanish.

## Preload API

`src/preload/preload.ts` exposes `window.bunnyPet`.

Key interaction methods:

- `updateGrabArea(area)` sends the current renderer-measured grab area to main.
- `startDrag(screenX, screenY)`, `dragTo(screenX, screenY)`, and `endDrag()` drive window dragging.
- `throwPet(velocityX, velocityY)` starts throw physics after release.
- `reportDizzy()` holds autonomous motion while the renderer shows the dizzy override.
- `setInteractive(interactive)` keeps the whole window interactive while reader/prompt/loading overlays are open.

The renderer should never import Electron or call `ipcRenderer` directly.

## Renderer

`src/renderer/App.tsx` renders the pet and reader UI.

`PetSprite` is responsible for:

- Animation frame cycling from `public/pet/manifest.json`.
- Pointer capture drag with a small click/drag tolerance.
- Release velocity tracking for throw physics.
- Spin gesture detection for the dizzy reaction.
- Live grab-area measurement.

### Grab Area Model

The grab system intentionally separates visual transforms from hit testing:

- `.petSprite` is the stable outer button and is only horizontally centered.
- `.petVisual` contains the actual sprite and receives scale/rotation/bob/hop/fall animations.
- `.grabProbe` is an invisible element positioned from `AnimationDefinition.hitbox`.
- Every animation frame, `PetSprite` calls `getBoundingClientRect()` on `.grabProbe` (or `.petVisual` if no manifest definition exists).
- The measured DOM rect is padded/clamped via `createGrabArea()` in `src/shared/petHitbox.ts`.
- The result is sent to main through `window.bunnyPet.updateGrabArea()`.

This means scale, rotation, CSS animation, state changes, and manifest hitbox changes are reflected in the actual selectable area without hand-maintained screen coordinates.

## Shared Modules

All files in `src/shared/` must stay pure TypeScript: no Electron imports and no DOM access.

| File | Responsibility |
| --- | --- |
| `types.ts` | shared app, manifest, reader, and motion types |
| `animationState.ts` | animation fallback/override resolution and duration helpers |
| `petMotion.ts` | roam/rest/hide/edge placement and movement helpers |
| `throwPhysics.ts` | release velocity and projectile stepping |
| `dragGesture.ts` | drag path sampling and dizzy spin detection |
| `petHitbox.ts` | pure rect helpers for live grab areas |
| `readerStorage.ts` | reader snapshot persistence |
| `reading.ts` | novel text normalization and line splitting |

## IPC Channels

| Channel | Direction | Purpose |
| --- | --- | --- |
| `pet:motion-state` | main -> renderer | push current animation/motion state |
| `reader:command` | main -> renderer | open URL prompt or load pasted reader content |
| `pet:update-grab-area` | renderer -> main | live window-local grab rectangle |
| `pet:set-interactive` | renderer -> main | overlay interaction override |
| `pet:start-drag` / `pet:drag-to` / `pet:end-drag` | renderer -> main | grab/drag/release window |
| `pet:dizzy` | renderer -> main | hold motion during dizzy override |
| `pet:throw` | renderer -> main | start throw physics from release velocity |
| `reader:load-url` | renderer -> main | fetch and parse a novel URL |
| `reader:load-manual-text` | renderer -> main | parse pasted text |
| `reader:close` / `reader:set-active` | renderer -> main | toggle reader mode |
| `pet:set-walking-paused` | renderer -> main | pause/resume autonomous movement |
| `pet:open-context-menu` | renderer -> main | show right-click pet menu |
| `app:quit` | renderer -> main | quit app |

## Assets

Place sprites under:

```text
public/pet/animations/<state>/<frame>.png
```

Describe every state in:

```text
public/pet/manifest.json
```

The manifest fields `size`, `anchor`, and especially `hitbox` are now part of the drag system. Keep `hitbox` aligned to the visible body for each animation state, because it drives `.grabProbe` and therefore the actual selectable area.

If sprite frames are regenerated, bump `assetVersion` to bust renderer image cache.

## Testing Notes

Core behavior has unit coverage in:

- `src/shared/petMotion.test.ts`
- `src/shared/throwPhysics.test.ts`
- `src/shared/dragGesture.test.ts`
- `src/shared/petHitbox.test.ts`
- reader and animation-state tests

Before pushing interaction changes, run:

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```
