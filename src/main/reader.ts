import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { createNovelPayload, normalizeNovelText } from "../shared/reading";
import type { NovelPayload } from "../shared/types";

const MIN_EXTRACTED_TEXT_LENGTH = 80;

export async function loadNovelFromUrl(sourceUrl: string): Promise<NovelPayload> {
  const url = new URL(sourceUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("只支持 http 或 https 小说网址。");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BunnyReaderPet/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`网页读取失败：HTTP ${response.status}`);
  }

  const html = await response.text();
  return extractNovelFromHtml(html, url.toString());
}

export function extractNovelFromHtml(
  html: string,
  sourceUrl: string
): NovelPayload {
  const dom = new JSDOM(html, { url: sourceUrl });
  const document = dom.window.document;
  const readability = new Readability(document.cloneNode(true) as Document);
  const article = readability.parse();
  const fallbackTitle = document.title || new URL(sourceUrl).hostname;
  const title = article?.title || fallbackTitle;
  const text = normalizeNovelText(
    article?.textContent || extractFallbackText(document)
  );

  if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new Error("没有提取到足够的正文内容，可以改用手动粘贴文本。");
  }

  return createNovelPayload(title, sourceUrl, text);
}

export function createManualNovelPayload(text: string): NovelPayload {
  const normalized = normalizeNovelText(text);
  if (normalized.length < 2) {
    throw new Error("文本太短，还不能进入阅读模式。");
  }

  return createNovelPayload("手动文本", "manual://local-text", normalized);
}

function extractFallbackText(document: Document): string {
  document
    .querySelectorAll("script, style, nav, header, footer, aside, noscript")
    .forEach((element) => element.remove());

  const likelyContent =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector("#content") ||
    document.querySelector(".content") ||
    document.body;

  return likelyContent?.textContent || "";
}
