import type { PetAnimationState, Rect } from "./types";

export interface Velocity {
  x: number;
  y: number;
}

export interface MotionStepResult {
  rect: Rect;
  velocity: Velocity;
  animation: PetAnimationState;
}

export function clampWindowToBounds(rect: Rect, bounds: Rect): Rect {
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width - rect.width),
    y: Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height - rect.height)
  };
}

export function stepWindowMotion(
  rect: Rect,
  velocity: Velocity,
  bounds: Rect
): MotionStepResult {
  const nextRect = {
    ...rect,
    x: rect.x + velocity.x,
    y: rect.y + velocity.y
  };

  const clamped = clampWindowToBounds(nextRect, bounds);
  const hitHorizontalEdge = clamped.x !== nextRect.x;
  const hitVerticalEdge = clamped.y !== nextRect.y;
  const nextVelocity = {
    x: hitHorizontalEdge ? -velocity.x : velocity.x,
    y: hitVerticalEdge ? -velocity.y : velocity.y
  };

  return {
    rect: clamped,
    velocity: nextVelocity,
    animation: nextVelocity.x < 0 ? "walk_left" : "walk_right"
  };
}

/**
 * Creates a 2-D velocity for the pet window.
 * The horizontal component is the primary walk direction; the vertical
 * component adds a gentle drift so the pet wanders across the full screen
 * instead of staying at a fixed Y position.
 *
 * @param random  - Seeded random function (useful for tests).
 * @param direction - Force a horizontal direction (1 = right, -1 = left).
 *                   When omitted, a random direction is chosen.
 */
export function createRandomVelocity(
  random = Math.random,
  direction?: 1 | -1
): Velocity {
  const dir: 1 | -1 = direction ?? (random() < 0.5 ? -1 : 1);
  const x = dir * (5.0 + random() * 3.0);
  // Vertical drift: ±0 – 2.5 px/tick — gentle enough that horizontal walk
  // is still the dominant motion, but the pet gradually explores different
  // vertical positions on screen.
  const y = (random() - 0.5) * 5.0;
  return { x, y };
}
