import { createNovelPayload, normalizeNovelText, splitIntoReadingLines } from "./reading";

describe("reading helpers", () => {
  it("normalizes whitespace without destroying paragraph breaks", () => {
    expect(normalizeNovelText("  第一章\r\n\r\n\r\n  开始了\t\t哦  ")).toBe(
      "第一章\n\n 开始了 哦"
    );
  });

  it("splits Chinese prose into one-line reader chunks", () => {
    const lines = splitIntoReadingLines(
      "她推开窗，夜色像潮水一样漫进来。兔耳轻轻晃了一下，她说：今天就读到这里吧！",
      18
    );

    expect(lines).toEqual([
      "她推开窗，夜色像潮水一样漫进来。",
      "兔耳轻轻晃了一下，她说：",
      "今天就读到这里吧！"
    ]);
  });

  it("creates a payload with computed lines", () => {
    const payload = createNovelPayload(
      "  测试书名  ",
      "https://example.com/book",
      "第一句。第二句。"
    );

    expect(payload.title).toBe("测试书名");
    expect(payload.lines).toEqual(["第一句。", "第二句。"]);
  });
});
