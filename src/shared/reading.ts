import type { NovelPayload } from "./types";

const SENTENCE_BREAK = /([。！？!?；;：:\n]+)\s*/g;
const SPACE_BREAK = /\s+/g;

export function normalizeNovelText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoReadingLines(text: string, maxChars = 32): string[] {
  const normalized = normalizeNovelText(text);

  if (!normalized) {
    return [];
  }

  const sentences = normalized
    .replace(SENTENCE_BREAK, "$1|")
    .split("|")
    .map((part) => part.replace(SPACE_BREAK, " ").trim())
    .filter(Boolean);

  const lines: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      lines.push(sentence);
      continue;
    }

    let cursor = 0;
    while (cursor < sentence.length) {
      lines.push(sentence.slice(cursor, cursor + maxChars).trim());
      cursor += maxChars;
    }
  }

  return lines;
}

export function createNovelPayload(
  title: string,
  sourceUrl: string,
  text: string,
  maxChars = 32
): NovelPayload {
  const normalizedText = normalizeNovelText(text);
  return {
    title: title.trim() || "未命名文本",
    sourceUrl,
    text: normalizedText,
    lines: splitIntoReadingLines(normalizedText, maxChars)
  };
}
