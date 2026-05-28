import { app, BrowserWindow, ipcMain, screen, type Rectangle } from "electron";
import { join } from "node:path";
import { createTray, openPetContextMenu } from "./menu";
import { PetMotionController } from "./motionController";
import {
  createManualNovelPayload,
  loadNovelFromUrl
} from "./reader";

let mainWindow: BrowserWindow | null = null;
let motion: PetMotionController | null = null;

const WINDOW_WIDTH = 294;
const WINDOW_HEIGHT = 378;
const WINDOW_MARGIN = 24;

interface DragPoint {
  screenX: number;
  screenY: number;
}

interface DragSession {
  startPoint: DragPoint;
  startBounds: Rectangle;
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

  motion = new PetMotionController(mainWindow);
  createTray(mainWindow, motion);
  registerIpc(mainWindow, motion);

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    motion?.start();
  });

  mainWindow.on("closed", () => {
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

  ipcMain.on("pet:start-drag", (_event, point: DragPoint) => {
    dragSession = {
      startPoint: point,
      startBounds: window.getBounds()
    };
    motionController.setUserDragging(true);
  });

  ipcMain.on("pet:drag-to", (_event, point: DragPoint) => {
    if (!dragSession || window.isDestroyed()) {
      return;
    }

    const nextBounds = {
      ...dragSession.startBounds,
      x:
        dragSession.startBounds.x +
        Math.round(point.screenX - dragSession.startPoint.screenX),
      y:
        dragSession.startBounds.y +
        Math.round(point.screenY - dragSession.startPoint.screenY)
    };

    window.setBounds(clampToVisibleDisplays(nextBounds), false);
  });

  ipcMain.on("pet:end-drag", () => {
    dragSession = null;
    motionController.setUserDragging(false);
  });

  ipcMain.handle("app:quit", () => {
    app.quit();
  });
}

function clampToVisibleDisplays(rect: Rectangle): Rectangle {
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  const minX = Math.min(...workAreas.map((area) => area.x));
  const minY = Math.min(...workAreas.map((area) => area.y));
  const maxX = Math.max(...workAreas.map((area) => area.x + area.width));
  const maxY = Math.max(...workAreas.map((area) => area.y + area.height));

  return {
    ...rect,
    x: clamp(rect.x, minX, maxX - rect.width),
    y: clamp(rect.y, minY, maxY - rect.height)
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
