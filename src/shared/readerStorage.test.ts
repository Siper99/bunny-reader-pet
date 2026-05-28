import {
  clearReaderSnapshot,
  createReaderSnapshot,
  loadReaderSnapshot,
  saveReaderSnapshot
} from "./readerStorage";
import type { NovelPayload } from "./types";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const payload: NovelPayload = {
  title: "测试",
  sourceUrl: "manual://local-text",
  text: "第一句。第二句。",
  lines: ["第一句。", "第二句。"]
};

describe("reader storage", () => {
  it("saves and restores reader progress", () => {
    const storage = new MemoryStorage();
    const snapshot = createReaderSnapshot(payload, {
      index: 1,
      autoPlay: true,
      speedMs: 3000
    });

    saveReaderSnapshot(storage, snapshot);

    expect(loadReaderSnapshot(storage)).toMatchObject({
      title: "测试",
      index: 1,
      autoPlay: true,
      speedMs: 3000
    });
  });

  it("clamps invalid indexes when restoring", () => {
    const storage = new MemoryStorage();
    saveReaderSnapshot(storage, createReaderSnapshot(payload, { index: 10 }));

    expect(loadReaderSnapshot(storage)?.index).toBe(1);
  });

  it("clears stored reader progress", () => {
    const storage = new MemoryStorage();
    saveReaderSnapshot(storage, createReaderSnapshot(payload));
    clearReaderSnapshot(storage);

    expect(loadReaderSnapshot(storage)).toBeNull();
  });
});
