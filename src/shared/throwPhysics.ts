/**
 * Throw physics — pure helpers for the "fling the pet and watch it arc and
 * fall" interaction. The renderer measures a release velocity from the final
 * drag samples; the main process integrates a simple projectile each tick.
 */

import type { Velocity } from "./petMotion";
import type { Rect } from "./types";

export interface ThrowSample {
  x: number;
  y: number;
  /** Timestamp in milliseconds. */
  t: number;
}

/** Release velocity in pixels per millisecond. */
export interface ReleaseVelocity {
  vx: number;
  vy: number;
}

export interface ProjectileStep {
  rect: Rect;
  /** Updated velocity (same units as input: pixels per tick). */
  velocity: Velocity;
  /** True once the pet has come to rest on the floor. */
  landed: boolean;
}

/**
 * Estimates the pointer velocity (px/ms) at release using the samples within
 * `lookbackMs` of the final sample. Returns zero velocity when there isn't
 * enough recent movement to measure.
 */
export function computeReleaseVelocity(
  samples: ThrowSample[],
  lookbackMs = 120
): ReleaseVelocity {
  if (samples.length < 2) {
    return { vx: 0, vy: 0 };
  }

  const last = samples[samples.length - 1];
  let first = samples[samples.length - 1];
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    first = samples[i];
    if (last.t - samples[i].t >= lookbackMs) {
      break;
    }
  }

  const dt = last.t - first.t;
  if (dt <= 0) {
    return { vx: 0, vy: 0 };
  }

  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

/** Magnitude of a release velocity (px/ms). */
export function releaseSpeed(velocity: ReleaseVelocity): number {
  return Math.hypot(velocity.vx, velocity.vy);
}

/**
 * Advances a projectile by one tick: applies gravity, moves, bounces off the
 * side walls and ceiling (damped by `restitution`), and clamps to the floor.
 * Velocity units are pixels per tick; gravity is pixels per tick².
 */
export function stepProjectile(
  rect: Rect,
  velocity: Velocity,
  bounds: Rect,
  gravity: number,
  restitution = 0.45
): ProjectileStep {
  const minX = bounds.x;
  const maxX = bounds.x + bounds.width - rect.width;
  const ceilingY = bounds.y;
  const floorY = bounds.y + bounds.height - rect.height;

  let vx = velocity.x;
  let vy = velocity.y + gravity;
  let nx = rect.x + vx;
  let ny = rect.y + vy;
  let landed = false;

  if (nx < minX) {
    nx = minX;
    vx = -vx * restitution;
  } else if (nx > maxX) {
    nx = maxX;
    vx = -vx * restitution;
  }

  if (ny < ceilingY) {
    ny = ceilingY;
    vy = -vy * restitution;
  }

  if (ny >= floorY) {
    ny = floorY;
    vx = 0;
    vy = 0;
    landed = true;
  }

  return { rect: { ...rect, x: nx, y: ny }, velocity: { x: vx, y: vy }, landed };
}
