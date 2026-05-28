import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createManualNovelPayload, extractNovelFromHtml } from "./reader";

describe("reader extraction", () => {
  it("extracts title and正文 from a local HTML fixture", () => {
    const html = readFileSync(
      join(__dirname, "__fixtures__", "novel.html"),
      "utf8"
    );
    const payload = extractNovelFromHtml(html, "https://example.com/novel/1");

    expect(payload.title).toContain("窗边的兔子");
    expect(payload.text).toContain("兔耳少女坐在灯下");
    expect(payload.lines.length).toBeGreaterThan(2);
  });

  it("fails when generic extraction cannot find enough text", () => {
    expect(() =>
      extractNovelFromHtml("<html><body><main>太短</main></body></html>", "https://example.com")
    ).toThrow(/正文内容/);
  });

  it("creates manual fallback payloads", () => {
    const payload = createManualNovelPayload("第一句。第二句。");

    expect(payload.sourceUrl).toBe("manual://local-text");
    expect(payload.lines).toEqual(["第一句。", "第二句。"]);
  });
});
