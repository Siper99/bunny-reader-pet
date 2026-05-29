import type {
  PetAnimationState,
  PetBehaviorMode,
  PetDirection,
  Rect
} from "./types";

export interface Velocity {
  x: number;
  y: number;
}

export interface MotionStepResult {
  rect: Rect;
  velocity: Velocity;
  animation: PetAnimationState;
}

export interface TargetStepResult {
  rect: Rect;
  direction: PetDirection;
  arrived: boolean;
}

export interface RestPlacement {
  rect: Rect;
  animation: PetAnimationState;
  direction: PetDirection | null;
  offscreen: boolean;
}

export interface PopoutPlacement {
  start: Rect;
  target: Rect;
  animation: PetAnimationState;
  direction: PetDirection;
}

export type ScheduledBehavior = Exclude<PetBehaviorMode, "drag" | "read">;

/** A physical screen edge (note: "top"/"bottom" are not `PetDirection`s). */
export type ScreenEdge = "left" | "right" | "top" | "bottom";

export interface EdgeExit {
  /** Fully-offscreen rect just past the chosen edge. */
  target: Rect;
  /** Movement direction while walking out through the edge. */
  direction: PetDirection;
}

const REST_MARGIN = 18;
const PEEK_VISIBLE_FRACTION = 0.48;
const OFFSCREEN_GAP = 18;

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

export function createRandomVelocity(
  random = Math.random,
  direction?: 1 | -1
): Velocity {
  const dir: 1 | -1 = direction ?? (random() < 0.5 ? -1 : 1);
  const x = dir * (5.0 + random() * 3.0);
  const y = (random() - 0.5) * 5.0;
  return { x, y };
}

export function chooseWeightedBehavior(random = Math.random): ScheduledBehavior {
  const roll = random();

  if (roll < 0.7) {
    return "rest";
  }

  if (roll < 0.8) {
    return "roam";
  }

  if (roll < 0.9) {
    return "hidden";
  }

  return "popout";
}

export function chooseBehaviorDurationMs(
  behavior: ScheduledBehavior,
  random = Math.random
): number {
  switch (behavior) {
    case "rest":
      return 8000 + random() * 17000;
    case "roam":
      return 3000 + random() * 5000;
    case "hidden":
      return 2000 + random() * 4000;
    case "popout":
      return 1000 + random() * 2000;
  }
}

export function chooseRoamTarget(
  rect: Rect,
  bounds: Rect,
  random = Math.random
): Rect {
  const maxX = bounds.x + bounds.width - rect.width;
  const maxY = bounds.y + bounds.height - rect.height;

  return {
    ...rect,
    x: Math.round(bounds.x + random() * Math.max(0, maxX - bounds.x)),
    y: Math.round(bounds.y + random() * Math.max(0, maxY - bounds.y))
  };
}

export function getDirectionToTarget(rect: Rect, target: Rect): PetDirection {
  const dx = target.x - rect.x;
  const dy = target.y - rect.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? "left" : "right";
  }

  return dy < 0 ? "up" : "down";
}

export function getMovementAnimation(
  direction: PetDirection,
  speed: "walk" | "run"
): PetAnimationState {
  return `${speed}_${direction}` as PetAnimationState;
}

export function stepTowardTarget(
  rect: Rect,
  target: Rect,
  speedPx: number
): TargetStepResult {
  const dx = target.x - rect.x;
  const dy = target.y - rect.y;
  const distance = Math.hypot(dx, dy);
  const direction = getDirectionToTarget(rect, target);

  if (distance <= speedPx || distance === 0) {
    return {
      rect: target,
      direction,
      arrived: true
    };
  }

  return {
    rect: {
      ...rect,
      x: rect.x + (dx / distance) * speedPx,
      y: rect.y + (dy / distance) * speedPx
    },
    direction,
    arrived: false
  };
}

export function chooseRestPlacement(
  rect: Rect,
  bounds: Rect,
  random = Math.random
): RestPlacement {
  const sideRoll = random();

  if (sideRoll >= 0.76) {
    const leftSide = random() < 0.5;
    const minY = bounds.y + REST_MARGIN;
    const maxY = bounds.y + bounds.height - rect.height - REST_MARGIN;

    return {
      rect: {
        ...rect,
        x: leftSide
          ? bounds.x - Math.round(rect.width * (1 - PEEK_VISIBLE_FRACTION))
          : bounds.x + bounds.width - Math.round(rect.width * PEEK_VISIBLE_FRACTION),
        y: Math.round(minY + random() * Math.max(0, maxY - minY))
      },
      animation: leftSide ? "peek_left" : "peek_right",
      direction: leftSide ? "left" : "right",
      offscreen: true
    };
  }

  const right = random() < 0.5;
  const bottom = random() < 0.5;

  return {
    rect: {
      ...rect,
      x: right
        ? bounds.x + bounds.width - rect.width - REST_MARGIN
        : bounds.x + REST_MARGIN,
      y: bottom
        ? bounds.y + bounds.height - rect.height - REST_MARGIN
        : bounds.y + REST_MARGIN
    },
    animation: "rest_corner",
    direction: null,
    offscreen: false
  };
}

export function chooseHiddenRect(
  rect: Rect,
  bounds: Rect,
  random = Math.random
): Rect {
  const side = Math.floor(random() * 4);
  const xInside = bounds.x + random() * Math.max(0, bounds.width - rect.width);
  const yInside = bounds.y + random() * Math.max(0, bounds.height - rect.height);

  switch (side) {
    case 0:
      return { ...rect, x: bounds.x - rect.width - OFFSCREEN_GAP, y: yInside };
    case 1:
      return { ...rect, x: bounds.x + bounds.width + OFFSCREEN_GAP, y: yInside };
    case 2:
      return { ...rect, x: xInside, y: bounds.y - rect.height - OFFSCREEN_GAP };
    default:
      return { ...rect, x: xInside, y: bounds.y + bounds.height + OFFSCREEN_GAP };
  }
}

export function choosePopoutPlacement(
  rect: Rect,
  bounds: Rect,
  random = Math.random
): PopoutPlacement {
  const side = Math.floor(random() * 4);
  const xInside = Math.round(
    bounds.x + random() * Math.max(0, bounds.width - rect.width)
  );
  const yInside = Math.round(
    bounds.y + random() * Math.max(0, bounds.height - rect.height)
  );

  switch (side) {
    case 0:
      return {
        start: { ...rect, x: bounds.x - rect.width + 26, y: yInside },
        target: { ...rect, x: bounds.x + REST_MARGIN, y: yInside },
        animation: "popout_left",
        direction: "right"
      };
    case 1:
      return {
        start: { ...rect, x: bounds.x + bounds.width - 26, y: yInside },
        target: {
          ...rect,
          x: bounds.x + bounds.width - rect.width - REST_MARGIN,
          y: yInside
        },
        animation: "popout_right",
        direction: "left"
      };
    case 2:
      return {
        start: { ...rect, x: xInside, y: bounds.y - rect.height + 26 },
        target: { ...rect, x: xInside, y: bounds.y + REST_MARGIN },
        animation: "popout_top",
        direction: "down"
      };
    default:
      return {
        start: { ...rect, x: xInside, y: bounds.y + bounds.height - 26 },
        target: {
          ...rect,
          x: xInside,
          y: bounds.y + bounds.height - rect.height - REST_MARGIN
        },
        animation: "popout_bottom",
        direction: "up"
      };
  }
}

/**
 * Picks the screen edge the pet is currently closest to. Used to make an
 * explicit "hide" walk out through the nearest edge (rather than vanish).
 */
export function nearestEdge(rect: Rect, bounds: Rect): ScreenEdge {
  const distLeft = rect.x - bounds.x;
  const distRight = bounds.x + bounds.width - (rect.x + rect.width);
  const distTop = rect.y - bounds.y;
  const distBottom = bounds.y + bounds.height - (rect.y + rect.height);
  const min = Math.min(distLeft, distRight, distTop, distBottom);

  if (min === distLeft) {
    return "left";
  }
  if (min === distRight) {
    return "right";
  }
  if (min === distTop) {
    return "top";
  }
  return "bottom";
}

/**
 * Builds a fully-offscreen target just past the given edge, plus the walk
 * direction to get there. The cross-axis position is preserved.
 */
export function edgeExitTarget(
  rect: Rect,
  bounds: Rect,
  edge: ScreenEdge
): EdgeExit {
  switch (edge) {
    case "left":
      return {
        target: { ...rect, x: bounds.x - rect.width - OFFSCREEN_GAP },
        direction: "left"
      };
    case "right":
      return {
        target: { ...rect, x: bounds.x + bounds.width + OFFSCREEN_GAP },
        direction: "right"
      };
    case "top":
      return {
        target: { ...rect, y: bounds.y - rect.height - OFFSCREEN_GAP },
        direction: "up"
      };
    default:
      return {
        target: { ...rect, y: bounds.y + bounds.height + OFFSCREEN_GAP },
        direction: "down"
      };
  }
}

/**
 * Deterministic popout entrance through a specific edge (mirror of
 * choosePopoutPlacement but for a known edge). The cross-axis coordinate is
 * clamped into the visible area so the pet re-enters near where it left.
 */
export function edgeEntry(
  rect: Rect,
  bounds: Rect,
  edge: ScreenEdge
): PopoutPlacement {
  const clampedY = Math.min(
    Math.max(rect.y, bounds.y + REST_MARGIN),
    bounds.y + bounds.height - rect.height - REST_MARGIN
  );
  const clampedX = Math.min(
    Math.max(rect.x, bounds.x + REST_MARGIN),
    bounds.x + bounds.width - rect.width - REST_MARGIN
  );

  switch (edge) {
    case "left":
      return {
        start: { ...rect, x: bounds.x - rect.width + 26, y: clampedY },
        target: { ...rect, x: bounds.x + REST_MARGIN, y: clampedY },
        animation: "popout_left",
        direction: "right"
      };
    case "right":
      return {
        start: { ...rect, x: bounds.x + bounds.width - 26, y: clampedY },
        target: {
          ...rect,
          x: bounds.x + bounds.width - rect.width - REST_MARGIN,
          y: clampedY
        },
        animation: "popout_right",
        direction: "left"
      };
    case "top":
      return {
        start: { ...rect, x: clampedX, y: bounds.y - rect.height + 26 },
        target: { ...rect, x: clampedX, y: bounds.y + REST_MARGIN },
        animation: "popout_top",
        direction: "down"
      };
    default:
      return {
        start: { ...rect, x: clampedX, y: bounds.y + bounds.height - 26 },
        target: {
          ...rect,
          x: clampedX,
          y: bounds.y + bounds.height - rect.height - REST_MARGIN
        },
        animation: "popout_bottom",
        direction: "up"
      };
  }
}
