import { clampWindowToBounds, createRandomVelocity, stepWindowMotion } from "./petMotion";

describe("pet motion", () => {
  it("clamps the pet window inside the current work area", () => {
    expect(
      clampWindowToBounds(
        { x: 190, y: -20, width: 60, height: 80 },
        { x: 0, y: 0, width: 200, height: 200 }
      )
    ).toEqual({ x: 140, y: 0, width: 60, height: 80 });
  });

  it("bounces when a movement step hits a horizontal edge", () => {
    const result = stepWindowMotion(
      { x: 0, y: 40, width: 60, height: 80 },
      { x: -4, y: 0 },
      { x: 0, y: 0, width: 200, height: 200 }
    );

    expect(result.rect.x).toBe(0);
    expect(result.velocity.x).toBe(4);
    expect(result.animation).toBe("walk_right");
  });

  it("creates non-zero random wandering velocity with vertical drift", () => {
    const velocity = createRandomVelocity(() => 0.25);

    expect(velocity.x).toBeLessThan(0);
    // Vertical drift is (random - 0.5) * 5.0; with random=0.25 → -1.25
    expect(velocity.y).not.toBe(0);
  });

  it("respects a forced direction when provided", () => {
    const right = createRandomVelocity(() => 0.5, 1);
    const left = createRandomVelocity(() => 0.5, -1);

    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeLessThan(0);
  });
});
