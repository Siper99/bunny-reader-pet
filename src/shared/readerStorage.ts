import type { NovelPayload, ReaderSnapshot } from "./types";

const DEFAULT_READER_SPEED_MS = 4200;
const STORAGE_KEY = "bunny-reader.snapshot";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createReaderSnapshot(
  payload: NovelPayload,
  patch: Partial<Pick<ReaderSnapshot, "index" | "autoPlay" | "speedMs">> = {}
): ReaderSnapshot {
  return {
    ...payload,
    index: clampReaderIndex(patch.index ?? 0, payload.lines.length),
    autoPlay: patch.autoPlay ?? false,
    speedMs: patch.speedMs ?? DEFAULT_READER_SPEED_MS
  };
}

export function clampReaderIndex(index: number, lineCount: number): number {
  if (lineCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.round(index), 0), lineCount - 1);
}

export function loadReaderSnapshot(storage: StorageLike): ReaderSnapshot | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ReaderSnapshot;
    if (!parsed.title || !parsed.text || !Array.isArray(parsed.lines)) {
      return null;
    }

    return {
      ...parsed,
      index: clampReaderIndex(parsed.index, parsed.lines.length),
      autoPlay: Boolean(parsed.autoPlay),
      speedMs:
        Number.isFinite(parsed.speedMs) && parsed.speedMs >= 1200
          ? parsed.speedMs
          : DEFAULT_READER_SPEED_MS
    };
  } catch {
    return null;
  }
}

export function saveReaderSnapshot(
  storage: StorageLike,
  snapshot: ReaderSnapshot
): void {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...snapshot,
      index: clampReaderIndex(snapshot.index, snapshot.lines.length)
    })
  );
}

export function clearReaderSnapshot(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEY);
}
