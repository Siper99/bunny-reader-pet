import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  clipboard,
  nativeImage
} from "electron";
import type { PetMotionController } from "./motionController";

let tray: Tray | null = null;

export function createTray(
  window: BrowserWindow,
  motion: PetMotionController
): Tray {
  if (tray) {
    return tray;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#1f2933"/>
      <path d="M12 15c-3-8-2-13 1-13 3 0 3 8 3 13h-4z" fill="#f7c6d0"/>
      <path d="M17 15c0-5 0-13 3-13s4 5 1 13h-4z" fill="#f7c6d0"/>
      <circle cx="16" cy="19" r="8" fill="#fff7ed"/>
      <circle cx="13" cy="18" r="1.4" fill="#1f2933"/>
      <circle cx="19" cy="18" r="1.4" fill="#1f2933"/>
      <path d="M13 23c2 1 4 1 6 0" fill="none" stroke="#1f2933" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  const icon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );

  tray = new Tray(icon);
  tray.setToolTip("Bunny Reader Pet");
  tray.setContextMenu(createTrayMenu(window, motion));
  tray.on("click", () => showPetWindow(window));

  return tray;
}

export function openPetContextMenu(
  window: BrowserWindow,
  motion: PetMotionController
): void {
  const menu = Menu.buildFromTemplate([
    {
      label: "看书模式",
      click: () => window.webContents.send("reader:command", { type: "prompt-url" })
    },
    {
      label: "粘贴小说网址",
      click: () => pasteClipboardIntoReader(window)
    },
    { type: "separator" },
    {
      label: "暂停移动",
      type: "checkbox",
      checked: motion.getState().paused,
      click: (item) => motion.setPaused(item.checked)
    },
    {
      label: "隐藏",
      click: () => window.hide()
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => app.quit()
    }
  ]);

  menu.popup({ window });
}

function createTrayMenu(
  window: BrowserWindow,
  motion: PetMotionController
): Menu {
  return Menu.buildFromTemplate([
    {
      label: "显示桌宠",
      click: () => showPetWindow(window)
    },
    {
      label: "暂停移动",
      type: "checkbox",
      checked: motion.getState().paused,
      click: (item) => motion.setPaused(item.checked)
    },
    {
      label: "退出",
      click: () => app.quit()
    }
  ]);
}

function showPetWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }

  window.show();
  window.focus();
}

function pasteClipboardIntoReader(window: BrowserWindow): void {
  const text = clipboard.readText().trim();

  if (isHttpUrl(text)) {
    window.webContents.send("reader:command", { type: "load-url", url: text });
    return;
  }

  if (text.length > 20) {
    window.webContents.send("reader:command", {
      type: "manual-text",
      text
    });
    return;
  }

  window.webContents.send("reader:command", { type: "prompt-url" });
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
