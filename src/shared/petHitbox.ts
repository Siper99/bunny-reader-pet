import type { Point, Rect } from "./types";

export const DEFAULT_GRAB_PADDING = 10;

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function isUsableRect(rect: Rect | null | undefined): rect is Rect {
  return Boolean(
    rect &&
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height) &&
      rect.width > 0 &&
      rect.height > 0
  );
}

export function inflateRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  };
}

export function clampRectToBounds(rect: Rect, bounds: Rect): Rect | null {
  const minX = Math.max(rect.x, bounds.x);
  const minY = Math.max(rect.y, bounds.y);
  const maxX = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const maxY = Math.min(rect.y + rect.height, bounds.y + bounds.height);

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function createGrabArea(
  visualRect: Rect,
  viewport: Rect,
  padding = DEFAULT_GRAB_PADDING
): Rect | null {
  if (!isUsableRect(visualRect) || !isUsableRect(viewport)) {
    return null;
  }

  return clampRectToBounds(inflateRect(visualRect, padding), viewport);
}
