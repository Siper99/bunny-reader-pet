/**
 * Drag-gesture analysis — pure, side-effect-free helpers used to detect when
 * the user has been "spinning" or vigorously shaking the pet while dragging it.
 *
 * The renderer feeds pointer samples (screen coords + timestamp) into these
 * functions; when {@link isDizzySpin} returns true the pet enters a dizzy state.
 */

export interface DragSample {
  x: number;
  y: number;
  /** Timestamp in milliseconds (e.g. Date.now()). */
  t: number;
}

export interface DizzyOptions {
  /** Rolling window of samples to consider, in ms. */
  windowMs?: number;
  /** Total turning (radians) within the window required to feel dizzy. */
  turnThreshold?: number;
  /** Minimum total path length (px) so a slow tiny wiggle never qualifies. */
  minPathPx?: number;
  /**
   * Fraction of `windowMs` the samples must span before triggering, so a quick
   * burst of spinning doesn't count — it must be sustained (~the full window).
   */
  minSpanFraction?: number;
}

/** Movement noise below this magnitude (px) is ignored when measuring turning. */
const MOVEMENT_EPSILON = 1;

/**
 * Sums the absolute heading change between consecutive movement vectors.
 * A full circle contributes ~2π; each back-and-forth reversal ~π.
 */
export function computeSpinScore(samples: DragSample[]): number {
  let total = 0;

  for (let i = 2; i < samples.length; i += 1) {
    const v1x = samples[i - 1].x - samples[i - 2].x;
    const v1y = samples[i - 1].y - samples[i - 2].y;
    const v2x = samples[i].x - samples[i - 1].x;
    const v2y = samples[i].y - samples[i - 1].y;

    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    if (mag1 <= MOVEMENT_EPSILON || mag2 <= MOVEMENT_EPSILON) {
      continue;
    }

    let delta = Math.atan2(v2y, v2x) - Math.atan2(v1y, v1x);
    // Normalize to [-π, π] so a turn is measured the short way around.
    while (delta > Math.PI) {
      delta -= 2 * Math.PI;
    }
    while (delta < -Math.PI) {
      delta += 2 * Math.PI;
    }

    total += Math.abs(delta);
  }

  return total;
}

/** Total length of the polyline through the samples, in pixels. */
export function pathLength(samples: DragSample[]): number {
  let length = 0;
  for (let i = 1; i < samples.length; i += 1) {
    length += Math.hypot(
      samples[i].x - samples[i - 1].x,
      samples[i].y - samples[i - 1].y
    );
  }
  return length;
}

/** Drops samples older than `windowMs` relative to `nowT`. */
export function pruneSamples(
  samples: DragSample[],
  nowT: number,
  windowMs: number
): DragSample[] {
  return samples.filter((sample) => nowT - sample.t <= windowMs);
}

/**
 * True when the recent drag samples represent sustained, high-frequency
 * spinning/shaking — i.e. the pet should get dizzy.
 */
export function isDizzySpin(
  samples: DragSample[],
  options: DizzyOptions = {}
): boolean {
  const windowMs = options.windowMs ?? 5000;
  const turnThreshold = options.turnThreshold ?? 6 * Math.PI;
  const minPathPx = options.minPathPx ?? 600;
  const minSpanFraction = options.minSpanFraction ?? 0.8;

  if (samples.length < 5) {
    return false;
  }

  const span = samples[samples.length - 1].t - samples[0].t;
  if (span < windowMs * minSpanFraction) {
    return false;
  }

  if (pathLength(samples) < minPathPx) {
    return false;
  }

  return computeSpinScore(samples) >= turnThreshold;
}
