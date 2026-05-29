import {
  computeSpinScore,
  isDizzySpin,
  pathLength,
  pruneSamples,
  type DragSample
} from "./dragGesture";

/** Generates points tracing `loops` full circles spread evenly over `spanMs`. */
function circleSamples(
  loops: number,
  spanMs: number,
  radius = 100,
  segmentsPerLoop = 36
): DragSample[] {
  const total = Math.round(loops * segmentsPerLoop);
  const samples: DragSample[] = [];
  for (let i = 0; i <= total; i += 1) {
    const angle = (i / segmentsPerLoop) * 2 * Math.PI;
    samples.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      t: (i / total) * spanMs
    });
  }
  return samples;
}

/** Generates a straight horizontal drag over `spanMs`. */
function lineSamples(points: number, spanMs: number): DragSample[] {
  const samples: DragSample[] = [];
  for (let i = 0; i < points; i += 1) {
    samples.push({ x: i * 10, y: 0, t: (i / (points - 1)) * spanMs });
  }
  return samples;
}

describe("drag gesture", () => {
  it("measures roughly 2π of turning per full circle", () => {
    const score = computeSpinScore(circleSamples(1, 1000));
    expect(score).toBeGreaterThan(2 * Math.PI - 0.5);
    expect(score).toBeLessThan(2 * Math.PI + 0.5);
  });

  it("reports near-zero turning for a straight drag", () => {
    expect(computeSpinScore(lineSamples(50, 1000))).toBeLessThan(0.2);
  });

  it("computes path length of a straight drag", () => {
    expect(pathLength(lineSamples(11, 1000))).toBeCloseTo(100, 5);
  });

  it("prunes samples older than the window", () => {
    const samples: DragSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 1, t: 3000 },
      { x: 2, y: 2, t: 6000 }
    ];
    expect(pruneSamples(samples, 6000, 5000)).toEqual([
      { x: 1, y: 1, t: 3000 },
      { x: 2, y: 2, t: 6000 }
    ]);
  });

  it("triggers dizzy after sustained spinning across the window", () => {
    // 4 loops over 5s ≈ 8π turning, long path, full-window span.
    expect(isDizzySpin(circleSamples(4, 5000))).toBe(true);
  });

  it("does not trigger for a short burst of spinning", () => {
    // Same amount of turning but crammed into 1s — not sustained.
    expect(isDizzySpin(circleSamples(4, 1000))).toBe(false);
  });

  it("does not trigger for a long but straight drag", () => {
    expect(isDizzySpin(lineSamples(80, 5000))).toBe(false);
  });

  it("does not trigger with too few samples", () => {
    expect(
      isDizzySpin([
        { x: 0, y: 0, t: 0 },
        { x: 10, y: 0, t: 2500 },
        { x: 0, y: 0, t: 5000 }
      ])
    ).toBe(false);
  });
});
