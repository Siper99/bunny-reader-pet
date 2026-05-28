import { BrowserWindow, screen } from "electron";
import {
  createRandomVelocity,
  stepWindowMotion,
  type Velocity
} from "../shared/petMotion";
import type { PetAnimationState, PetMotionState, Rect } from "../shared/types";

type MotionMode = "idle" | "walk";

export class PetMotionController {
  private readonly tickMs = 80;
  private timer: NodeJS.Timeout | null = null;
  private mode: MotionMode = "idle";
  private nextDecisionAt = 0;
  private velocity: Velocity = { x: 0, y: 0 };
  private animation: PetAnimationState = "enter";
  private paused = false;
  private readerActive = false;
  private userDragging = false;
  /** Tracks the most recent horizontal walk direction so re-decisions don't cause jarring 180° turns. */
  private lastWalkDirX: 1 | -1 = 1;

  constructor(private readonly window: BrowserWindow) {}

  start(): void {
    this.stop();
    // Give the enter animation ~1.5 s to play before the first movement decision.
    this.nextDecisionAt = Date.now() + 1500;
    this.emitState();
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.emitState();
  }

  setReaderActive(active: boolean): void {
    this.readerActive = active;
    this.emitState();
  }

  setUserDragging(dragging: boolean): void {
    this.userDragging = dragging;

    if (dragging) {
      this.mode = "idle";
      this.velocity = { x: 0, y: 0 };
      this.setAnimation(this.readerActive ? "read_idle" : "idle");
      return;
    }

    this.nextDecisionAt = Date.now() + 900;
    this.emitState();
  }

  getState(): PetMotionState {
    return {
      animation: this.readerActive ? "read_idle" : this.animation,
      paused: this.paused,
      readerActive: this.readerActive
    };
  }

  private tick(): void {
    if (this.window.isDestroyed() || !this.window.isVisible()) {
      return;
    }

    if (this.userDragging) {
      this.setAnimation(this.readerActive ? "read_idle" : "idle");
      return;
    }

    if (this.paused || this.readerActive) {
      this.setAnimation(this.readerActive ? "read_idle" : "idle");
      return;
    }

    const now = Date.now();
    if (now >= this.nextDecisionAt) {
      this.chooseNextAction(now);
    }

    if (this.mode === "idle") {
      this.setAnimation("idle");
      return;
    }

    const rect = this.window.getBounds();
    const bounds = this.getCurrentWorkArea(rect);
    const step = stepWindowMotion(rect, this.velocity, bounds);

    this.velocity = step.velocity;

    // Keep lastWalkDirX in sync with the post-bounce velocity so the next
    // direction decision naturally continues from where the pet ended up.
    if (step.velocity.x !== 0) {
      this.lastWalkDirX = step.velocity.x > 0 ? 1 : -1;
    }

    this.window.setBounds(roundRect(step.rect), false);
    this.setAnimation(step.animation);
  }

  private chooseNextAction(now: number): void {
    if (Math.random() < 0.42) {
      this.mode = "idle";
      this.velocity = { x: 0, y: 0 };
      this.nextDecisionAt = now + 1500 + Math.random() * 3500;
      return;
    }

    this.mode = "walk";

    // 30% chance to reverse direction — avoids jarring 180° turns while still
    // letting the pet explore both sides of the screen over time.
    if (Math.random() < 0.3) {
      this.lastWalkDirX = this.lastWalkDirX === 1 ? -1 : 1;
    }

    this.velocity = createRandomVelocity(Math.random, this.lastWalkDirX);
    this.nextDecisionAt = now + 2500 + Math.random() * 5500;
  }

  private setAnimation(animation: PetAnimationState): void {
    if (this.animation === animation) {
      return;
    }

    this.animation = animation;
    this.emitState();
  }

  private emitState(): void {
    if (this.window.isDestroyed()) {
      return;
    }

    this.window.webContents.send("pet:motion-state", this.getState());
  }

  private getCurrentWorkArea(rect: Rect): Rect {
    const display = screen.getDisplayMatching(rect);
    return display.workArea;
  }
}

function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}
