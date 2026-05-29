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
