import { app, BrowserWindow, ipcMain, screen, type Rectangle } from "electron";
import { join } from "node:path";
import { createTray, openPetContextMenu } from "./menu";
import { PetMotionController } from "./motionController";
import {
  createManualNovelPayload,
  loadNovelFromUrl
} from "./reader";
import { isUsableRect, pointInRect } from "../shared/petHitbox";
import type { Point, Rect } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let motion: PetMotionController | null = null;
let pointerPollTimer: NodeJS.Timeout | null = null;
/** When true (an overlay/reader is open) the whole window stays interactive. */
let forceInteractive = false;
/** True for the whole duration of a drag, so it can never be interrupted. */
let isDragging = false;
/** Renderer-reported grab area in window-local coordinates. */
let currentGrabArea: Rect | null = null;

const WINDOW_WIDTH = 294;
const WINDOW_HEIGHT = 378;
const WINDOW_MARGIN = 24;
/**
 * The visible bunny's rectangle inside the (mostly transparent) window —
 * centred horizontally, near the bottom, with padding for hops/animation.
 * Everything outside this is click-through so it never blocks typing; inside
 * it the window captures the mouse so the bunny is always grabbable.
 */
/**
 * Anchor point dragging clamps to the screen (centre of the bunny rect), so the
 * bunny can reach every edge while the empty window area overflows off-screen.
 */

interface DragPoint {
  screenX: number;
  screenY: number;
}

interface DragSession {
  startBounds: Rectangle;
  grabOffset: Point;
}

function createWindow(): void {
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: workArea.x + workArea.width - WINDOW_WIDTH - WINDOW_MARGIN,
    y: workArea.y + workArea.height - WINDOW_HEIGHT - WINDOW_MARGIN,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Start click-through: the large transparent window must not block typing or
  // selecting underneath it. The main process polls the cursor and re-enables
  // interaction only while the cursor is over the bunny (see updateClickThrough).
  mainWindow.setIgnoreMouseEvents(true);

  motion = new PetMotionController(mainWindow);
  createTray(mainWindow, motion);
  registerIpc(mainWindow, motion);

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    motion?.start();
    startPointerPoll();
  });

  mainWindow.on("closed", () => {
    stopPointerPoll();
    motion?.stop();
    motion = null;
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function registerIpc(
  window: BrowserWindow,
  motionController: PetMotionController
): void {
  let dragSession: DragSession | null = null;

  ipcMain.handle("reader:load-url", async (_event, url: string) => {
    const payload = await loadNovelFromUrl(url);
    motionController.setReaderActive(true);
    return payload;
  });

  ipcMain.handle("reader:load-manual-text", (_event, text: string) => {
    const payload = createManualNovelPayload(text);
    motionController.setReaderActive(true);
    return payload;
  });

  ipcMain.handle("reader:close", () => {
    motionController.setReaderActive(false);
  });

  ipcMain.handle("reader:set-active", (_event, active: boolean) => {
    motionController.setReaderActive(active);
  });

  ipcMain.handle("pet:set-walking-paused", (_event, paused: boolean) => {
    motionController.setPaused(paused);
    return motionController.getState();
  });

  ipcMain.on("pet:open-context-menu", () => {
    openPetContextMenu(window, motionController);
  });

  ipcMain.on("pet:set-interactive", (_event, interactive: boolean) => {
    // Overlay (reader/prompt/loading) override: keep the whole window
    // interactive while one is open; otherwise fall back to cursor polling.
    forceInteractive = interactive;
    updateClickThrough();
  });

  ipcMain.on("pet:update-grab-area", (_event, area: Rect | null) => {
    currentGrabArea = isUsableRect(area) ? area : null;
    updateClickThrough();
  });

  ipcMain.on("pet:start-drag", (_event, point: DragPoint) => {
    const startBounds = window.getBounds();
    const grabOffset = {
      x: point.screenX - startBounds.x,
      y: point.screenY - startBounds.y
    };

    if (!forceInteractive && !pointInCurrentGrabArea(grabOffset)) {
      return;
    }

    dragSession = {
      startBounds,
      grabOffset
    };
    isDragging = true;
    updateClickThrough();
    motionController.setUserDragging(true);
  });

  ipcMain.on("pet:drag-to", (_event, point: DragPoint) => {
    if (!dragSession || window.isDestroyed()) {
      return;
    }

    const nextBounds = {
      ...dragSession.startBounds,
      x: Math.round(point.screenX - dragSession.grabOffset.x),
      y: Math.round(point.screenY - dragSession.grabOffset.y)
    };

    window.setBounds(clampDragBounds(nextBounds, dragSession.grabOffset), false);
  });

  ipcMain.on("pet:end-drag", () => {
    dragSession = null;
    isDragging = false;
    motionController.setUserDragging(false);
    updateClickThrough();
  });

  ipcMain.on("pet:dizzy", () => {
    motionController.setDizzy();
  });

  ipcMain.on(
    "pet:throw",
    (_event, velocity: { velocityX: number; velocityY: number }) => {
      motionController.throwFrom(velocity.velocityX, velocity.velocityY);
      updateClickThrough();
    }
  );

  ipcMain.handle("app:quit", () => {
    app.quit();
  });
}

/**
 * Polls the real cursor position (in the main process, so there's no async
 * race with the renderer) and makes the window interactive only while the
 * cursor is actually over the bunny. Everything else stays click-through so it
 * never blocks typing or selecting underneath.
 */
function startPointerPoll(): void {
  stopPointerPoll();
  updateClickThrough();
  pointerPollTimer = setInterval(updateClickThrough, 40);
}

function stopPointerPoll(): void {
  if (pointerPollTimer) {
    clearInterval(pointerPollTimer);
    pointerPollTimer = null;
  }
}

/**
 * Decides whether the window should capture the mouse and RE-ASSERTS it every
 * tick (no caching). Frequent setBounds calls (roaming / throw) and focus
 * changes can silently reset the ignore-mouse state on Windows; re-applying it
 * each poll guarantees the pet stays selectable instead of getting stuck.
 */
function updateClickThrough(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const ignore = computeIgnoreMouse();
  // `forward` is intentionally omitted: it's only valid when ignoring, and the
  // main process polls the cursor directly (no forwarded DOM events needed).
  mainWindow.setIgnoreMouseEvents(ignore);
}

function computeIgnoreMouse(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true;
  }
  if (forceInteractive || isDragging) {
    return false;
  }
  if (!mainWindow.isVisible()) {
    return true;
  }

  const cursor = screen.getCursorScreenPoint();
  const b = mainWindow.getBounds();
  const localPoint = { x: cursor.x - b.x, y: cursor.y - b.y };

  return !pointInCurrentGrabArea(localPoint);
}

/**
 * Clamps a dragged window so the *bunny anchor* (not the whole window) stays
 * within the full virtual screen — including over the taskbar. This lets the
 * pet be dropped anywhere on screen while the transparent window overflows.
 */
function pointInCurrentGrabArea(localPoint: Point): boolean {
  return isUsableRect(currentGrabArea) && pointInRect(localPoint, currentGrabArea);
}

function clampDragBounds(rect: Rectangle, anchor: Point): Rectangle {
  const bounds = screen.getAllDisplays().map((display) => display.bounds);
  const minX = Math.min(...bounds.map((area) => area.x));
  const minY = Math.min(...bounds.map((area) => area.y));
  const maxX = Math.max(...bounds.map((area) => area.x + area.width));
  const maxY = Math.max(...bounds.map((area) => area.y + area.height));

  const anchorX = rect.x + anchor.x;
  const anchorY = rect.y + anchor.y;
  const clampedAnchorX = clamp(anchorX, minX, maxX);
  const clampedAnchorY = clamp(anchorY, minY, maxY);

  return {
    ...rect,
    x: Math.round(clampedAnchorX - anchor.x),
    y: Math.round(clampedAnchorY - anchor.y)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  motion?.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
