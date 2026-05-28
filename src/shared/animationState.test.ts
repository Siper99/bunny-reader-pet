import {
  getAnimationDurationMs,
  pickTapReaction,
  resolveAnimationState
} from "./animationState";
import type { PetManifest } from "./types";

const manifest: PetManifest = {
  defaultState: "idle",
  fallbackState: "idle",
  states: {
    idle: {
      fps: 4,
      loop: true,
      framesPath: "/idle",
      frames: ["0.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    },
    walk_left: {
      fps: 4,
      loop: true,
      framesPath: "/walk_left",
      frames: ["0.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    },
    walk_right: {
      fps: 4,
      loop: true,
      framesPath: "/walk_right",
      frames: ["0.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    },
    enter: {
      fps: 4,
      loop: false,
      framesPath: "/enter",
      frames: ["0.png", "1.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    },
    exit: {
      fps: 4,
      loop: false,
      framesPath: "/exit",
      frames: ["0.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    },
    tap_happy: {
      fps: 10,
      loop: false,
      framesPath: "/tap_happy",
      frames: ["0.png", "1.png", "2.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    },
    tap_annoyed: {
      fps: 10,
      loop: false,
      framesPath: "/tap_annoyed",
      frames: ["0.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    },
    read_idle: {
      fps: 4,
      loop: true,
      framesPath: "/read_idle",
      frames: ["0.png"],
      size: { width: 1, height: 1 },
      anchor: { x: 0.5, y: 1 },
      hitbox: { x: 0, y: 0, width: 1, height: 1 }
    }
  }
};

describe("animation state", () => {
  it("lets click reactions override movement and reading", () => {
    expect(
      resolveAnimationState({
        motionState: "walk_left",
        readerActive: true,
        overrideState: "tap_happy"
      })
    ).toBe("tap_happy");
  });

  it("uses read idle while the reader is open", () => {
    expect(
      resolveAnimationState({
        motionState: "walk_right",
        readerActive: true,
        overrideState: null
      })
    ).toBe("read_idle");
  });

  it("picks deterministic tap reactions", () => {
    expect(pickTapReaction(() => 0.1)).toBe("tap_happy");
    expect(pickTapReaction(() => 0.9)).toBe("tap_annoyed");
  });

  it("computes finite animation durations", () => {
    expect(getAnimationDurationMs(manifest, "tap_happy")).toBe(300);
    expect(getAnimationDurationMs(manifest, "idle", 777)).toBe(777);
  });
});
