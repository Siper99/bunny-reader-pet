import {
  clampRectToBounds,
  createGrabArea,
  inflateRect,
  isUsableRect,
  pointInRect
} from "./petHitbox";
import type { Rect } from "./types";

describe("pet hitbox", () => {
  it("inflates the live visual rect instead of switching fixed boxes", () => {
    expect(inflateRect({ x: 20, y: 30, width: 40, height: 50 }, 8)).toEqual({
      x: 12,
      y: 22,
      width: 56,
      height: 66
    });
  });

  it("clamps reported grab areas to the renderer viewport", () => {
    const viewport: Rect = { x: 0, y: 0, width: 294, height: 378 };

    expect(
      clampRectToBounds({ x: -10, y: 360, width: 40, height: 40 }, viewport)
    ).toEqual({ x: 0, y: 360, width: 30, height: 18 });
  });

  it("returns null when a visual rect is fully outside the viewport", () => {
    const viewport: Rect = { x: 0, y: 0, width: 294, height: 378 };

    expect(
      clampRectToBounds({ x: 400, y: 20, width: 30, height: 30 }, viewport)
    ).toBeNull();
  });

  it("creates a padded local grab area from the transformed visual bounds", () => {
    const viewport: Rect = { x: 0, y: 0, width: 294, height: 378 };

    expect(
      createGrabArea({ x: 110, y: 210, width: 34, height: 84 }, viewport, 10)
    ).toEqual({ x: 100, y: 200, width: 54, height: 104 });
  });

  it("rejects invalid or empty rectangles", () => {
    expect(isUsableRect(null)).toBe(false);
    expect(isUsableRect({ x: 0, y: 0, width: 0, height: 10 })).toBe(false);
    expect(isUsableRect({ x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it("checks points against the current reported grab area", () => {
    const grabArea = { x: 100, y: 200, width: 54, height: 104 };

    expect(pointInRect({ x: 120, y: 240 }, grabArea)).toBe(true);
    expect(pointInRect({ x: 80, y: 240 }, grabArea)).toBe(false);
  });
});
