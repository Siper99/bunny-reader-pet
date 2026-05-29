import {
  computeReleaseVelocity,
  releaseSpeed,
  stepProjectile,
  type ThrowSample
} from "./throwPhysics";

describe("throw physics", () => {
  it("measures release velocity from the final samples", () => {
    const samples: ThrowSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 10, y: -10, t: 50 },
      { x: 20, y: -20, t: 100 }
    ];

    const velocity = computeReleaseVelocity(samples);
    // 20px over 100ms = 0.2 px/ms on each axis (upward = negative y).
    expect(velocity.vx).toBeCloseTo(0.2, 5);
    expect(velocity.vy).toBeCloseTo(-0.2, 5);
  });

  it("returns zero velocity when there is no movement history", () => {
    expect(computeReleaseVelocity([{ x: 5, y: 5, t: 10 }])).toEqual({
      vx: 0,
      vy: 0
    });
  });

  it("computes the speed magnitude", () => {
    expect(releaseSpeed({ vx: 3, vy: 4 })).toBeCloseTo(5, 5);
  });

  it("applies gravity so a rising throw decelerates", () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
    const step = stepProjectile(
      { x: 100, y: 500, width: 100, height: 100 },
      { x: 4, y: -20 },
      bounds,
      5
    );

    // vy moves toward the ground by gravity each tick: -20 + 5 = -15.
    expect(step.velocity.y).toBe(-15);
    expect(step.rect.y).toBe(485);
    expect(step.landed).toBe(false);
  });

  it("lands and rests on the floor", () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
    // Floor for a 100-tall sprite is y = 900; start just above moving down fast.
    const step = stepProjectile(
      { x: 100, y: 890, width: 100, height: 100 },
      { x: 6, y: 40 },
      bounds,
      5
    );

    expect(step.landed).toBe(true);
    expect(step.rect.y).toBe(900);
    expect(step.velocity).toEqual({ x: 0, y: 0 });
  });

  it("bounces off a side wall with damping", () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
    const step = stepProjectile(
      { x: 5, y: 400, width: 100, height: 100 },
      { x: -20, y: 0 },
      bounds,
      5,
      0.5
    );

    expect(step.rect.x).toBe(0);
    // Horizontal velocity reverses and is damped: -(-20) * 0.5 = 10.
    expect(step.velocity.x).toBe(10);
  });
});
