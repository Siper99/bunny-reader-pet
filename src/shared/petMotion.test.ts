import {
  chooseHiddenRect,
  choosePopoutPlacement,
  chooseRestPlacement,
  chooseWeightedBehavior,
  clampWindowToBounds,
  createRandomVelocity,
  edgeEntry,
  edgeExitTarget,
  getMovementAnimation,
  nearestEdge,
  stepTowardTarget,
  stepWindowMotion
} from "./petMotion";

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

  it("maps weighted behavior boundaries to 70/10/10/10 buckets", () => {
    expect(chooseWeightedBehavior(() => 0.69)).toBe("rest");
    expect(chooseWeightedBehavior(() => 0.7)).toBe("roam");
    expect(chooseWeightedBehavior(() => 0.8)).toBe("hidden");
    expect(chooseWeightedBehavior(() => 0.9)).toBe("popout");
  });

  it("steps toward a target and reports the dominant direction", () => {
    const result = stepTowardTarget(
      { x: 10, y: 10, width: 20, height: 20 },
      { x: 30, y: 13, width: 20, height: 20 },
      5
    );

    expect(result.direction).toBe("right");
    expect(result.arrived).toBe(false);
    expect(result.rect.x).toBeGreaterThan(10);
  });

  it("supports four-direction movement animation names", () => {
    expect(getMovementAnimation("up", "walk")).toBe("walk_up");
    expect(getMovementAnimation("down", "run")).toBe("run_down");
  });

  it("can choose a normal corner rest placement inside the work area", () => {
    const placement = chooseRestPlacement(
      { x: 0, y: 0, width: 60, height: 80 },
      { x: 0, y: 0, width: 200, height: 200 },
      () => 0.1
    );

    expect(placement.animation).toBe("rest_corner");
    expect(placement.offscreen).toBe(false);
    expect(placement.rect.x).toBeGreaterThanOrEqual(0);
    expect(placement.rect.y).toBeGreaterThanOrEqual(0);
  });

  it("can choose a side peek placement that is partly offscreen", () => {
    const placement = chooseRestPlacement(
      { x: 0, y: 0, width: 60, height: 80 },
      { x: 0, y: 0, width: 200, height: 200 },
      () => 0.9
    );

    expect(placement.animation).toBe("peek_right");
    expect(placement.offscreen).toBe(true);
    expect(placement.rect.x).toBeGreaterThan(140);
  });

  it("places hidden behavior outside the normal work area", () => {
    const hidden = chooseHiddenRect(
      { x: 0, y: 0, width: 60, height: 80 },
      { x: 0, y: 0, width: 200, height: 200 },
      () => 0
    );

    expect(hidden.x).toBeLessThan(0);
  });

  it("creates a popout path from offscreen toward an onscreen target", () => {
    const popout = choosePopoutPlacement(
      { x: 0, y: 0, width: 60, height: 80 },
      { x: 0, y: 0, width: 200, height: 200 },
      () => 0
    );

    expect(popout.animation).toBe("popout_left");
    expect(popout.start.x).toBeLessThan(popout.target.x);
    expect(popout.direction).toBe("right");
  });

  it("finds the nearest screen edge", () => {
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    // Closest to the left edge.
    expect(nearestEdge({ x: 5, y: 80, width: 40, height: 40 }, bounds)).toBe(
      "left"
    );
    // Closest to the bottom edge.
    expect(nearestEdge({ x: 80, y: 150, width: 40, height: 40 }, bounds)).toBe(
      "bottom"
    );
  });

  it("builds a fully-offscreen exit target past the chosen edge", () => {
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    const rect = { x: 150, y: 80, width: 40, height: 40 };

    const exit = edgeExitTarget(rect, bounds, "right");
    expect(exit.direction).toBe("right");
    // Left side of the sprite is past the right edge of the work area.
    expect(exit.target.x).toBeGreaterThanOrEqual(bounds.x + bounds.width);
    expect(exit.target.y).toBe(rect.y);
  });

  it("builds an edge entrance that starts offscreen and ends inside", () => {
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    const rect = { x: -40, y: 80, width: 40, height: 40 };

    const entry = edgeEntry(rect, bounds, "left");
    expect(entry.animation).toBe("popout_left");
    expect(entry.direction).toBe("right");
    expect(entry.start.x).toBeLessThan(entry.target.x);
    expect(entry.target.x).toBeGreaterThanOrEqual(bounds.x);
  });
});
