import { contextBridge, ipcRenderer } from "electron";
import type { NovelPayload, PetMotionState, Rect } from "../shared/types";

type ReaderCommand =
  | { type: "prompt-url" }
  | { type: "load-url"; url: string }
  | { type: "manual-text"; text: string };

type Unsubscribe = () => void;

const api = {
  loadNovelFromUrl(url: string): Promise<NovelPayload> {
    return ipcRenderer.invoke("reader:load-url", url);
  },
  loadManualText(text: string): Promise<NovelPayload> {
    return ipcRenderer.invoke("reader:load-manual-text", text);
  },
  setWalkingPaused(paused: boolean): Promise<PetMotionState> {
    return ipcRenderer.invoke("pet:set-walking-paused", paused);
  },
  setReaderActive(active: boolean): Promise<void> {
    return ipcRenderer.invoke("reader:set-active", active);
  },
  closeReader(): Promise<void> {
    return ipcRenderer.invoke("reader:close");
  },
  quitApp(): Promise<void> {
    return ipcRenderer.invoke("app:quit");
  },
  openContextMenu(): void {
    ipcRenderer.send("pet:open-context-menu");
  },
  setInteractive(interactive: boolean): void {
    ipcRenderer.send("pet:set-interactive", interactive);
  },
  updateGrabArea(area: Rect | null): void {
    ipcRenderer.send("pet:update-grab-area", area);
  },
  startDrag(screenX: number, screenY: number): void {
    ipcRenderer.send("pet:start-drag", { screenX, screenY });
  },
  dragTo(screenX: number, screenY: number): void {
    ipcRenderer.send("pet:drag-to", { screenX, screenY });
  },
  endDrag(): void {
    ipcRenderer.send("pet:end-drag");
  },
  reportDizzy(): void {
    ipcRenderer.send("pet:dizzy");
  },
  throwPet(velocityX: number, velocityY: number): void {
    ipcRenderer.send("pet:throw", { velocityX, velocityY });
  },
  onMotionState(callback: (state: PetMotionState) => void): Unsubscribe {
    const handler = (_event: Electron.IpcRendererEvent, state: PetMotionState) =>
      callback(state);
    ipcRenderer.on("pet:motion-state", handler);
    return () => ipcRenderer.removeListener("pet:motion-state", handler);
  },
  onReaderCommand(callback: (command: ReaderCommand) => void): Unsubscribe {
    const handler = (_event: Electron.IpcRendererEvent, command: ReaderCommand) =>
      callback(command);
    ipcRenderer.on("reader:command", handler);
    return () => ipcRenderer.removeListener("reader:command", handler);
  }
};

contextBridge.exposeInMainWorld("bunnyPet", api);

export type BunnyPetApi = typeof api;
