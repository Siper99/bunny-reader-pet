import type { BunnyPetApi } from "../preload/preload";
import { createNovelPayload } from "../shared/reading";
import type { PetMotionState } from "../shared/types";

type ReaderCommand = { type: "prompt-url" };

export function installBrowserPreviewApi(): void {
  if (window.bunnyPet) {
    return;
  }

  const motionListeners = new Set<(state: PetMotionState) => void>();
  const commandListeners = new Set<(command: ReaderCommand) => void>();
  let paused = false;
  let walkRight = true;

  window.setInterval(() => {
    if (paused) {
      emitMotion(createPreviewMotion("idle", paused));
      return;
    }

    walkRight = !walkRight;
    emitMotion(createPreviewMotion(walkRight ? "walk_right" : "walk_left", paused));
  }, 3200);

  const api: BunnyPetApi = {
    async loadNovelFromUrl(url) {
      return createNovelPayload(
        "浏览器预览文本",
        url,
        "这是浏览器预览模式下的示例正文。Electron 运行时会从主进程抓取网页正文；如果网站限制抓取，就会提示你手动粘贴文本。"
      );
    },
    async loadManualText(text) {
      return createNovelPayload("手动文本", "manual://browser-preview", text);
    },
    async setWalkingPaused(nextPaused) {
      paused = nextPaused;
      const state = createPreviewMotion(paused ? "idle" : "walk_right", paused);
      emitMotion(state);
      return state;
    },
    async setReaderActive() {},
    async closeReader() {},
    async quitApp() {},
    openContextMenu() {
      for (const listener of commandListeners) {
        listener({ type: "prompt-url" });
      }
    },
    setInteractive() {},
    updateGrabArea() {},
    startDrag() {},
    dragTo() {},
    endDrag() {},
    reportDizzy() {},
    throwPet() {},
    onMotionState(callback) {
      motionListeners.add(callback);
      callback(createPreviewMotion("idle", paused));
      return () => motionListeners.delete(callback);
    },
    onReaderCommand(callback) {
      commandListeners.add(callback);
      return () => commandListeners.delete(callback);
    }
  };

  window.bunnyPet = api;

  function emitMotion(state: PetMotionState): void {
    for (const listener of motionListeners) {
      listener(state);
    }
  }
}

function createPreviewMotion(
  animation: PetMotionState["animation"],
  paused: boolean
): PetMotionState {
  return {
    animation,
    behavior: animation.startsWith("walk_") ? "roam" : "rest",
    direction: animation.endsWith("_left")
      ? "left"
      : animation.endsWith("_right")
        ? "right"
        : null,
    dragging: false,
    offscreen: false,
    paused,
    readerActive: false
  };
}
