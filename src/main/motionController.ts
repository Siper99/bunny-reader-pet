import { BrowserWindow, screen } from "electron";
import {
  chooseBehaviorDurationMs,
  chooseHiddenRect,
  choosePopoutPlacement,
  chooseRestPlacement,
  chooseRoamTarget,
  chooseWeightedBehavior,
  getMovementAnimation,
  stepTowardTarget
} from "../shared/petMotion";
import type {
  PetAnimationState,
  PetBehaviorMode,
  PetDirection,
  PetMotionState,
  Rect
} from "../shared/types";

type MotionMode = "rest" | "roam" | "hidden" | "popout" | "drag";

const TICK_MS = 80;
const DRAG_RELEASE_MS = 650;
const ROAM_SPEED = 5.8;
const RUN_SPEED = 9.6;
const POPOUT_SPEED = 12;

export class PetMotionController {
  private timer: NodeJS.Timeout | null = null;
  private mode: MotionMode = "popout";
  private nextDecisionAt = 0;
  private targetRect: Rect | null = null;
  private animation: PetAnimationState = "popout_right";
  private behavior: PetBehaviorMode = "popout";
  private direction: PetDirection | null = "left";
  private offscreen = true;
  private paused = false;
  private readerActive = false;
  private userDragging = false;
  private forceInitialPopout = true;
  private dragReleaseUntil = 0;
  private roamUsesRun = false;

  constructor(private readonly window: BrowserWindow) {}

  start(): void {
    this.stop();
    this.window.setOpacity(1);
    this.nextDecisionAt = Date.now();
    this.forceInitialPopout = true;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
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
    this.window.setOpacity(1);
    this.emitState();
  }

  setUserDragging(dragging: boolean): void {
    this.userDragging = dragging;
    this.window.setOpacity(1);

    if (dragging) {
      this.mode = "drag";
      this.behavior = "drag";
      this.offscreen = false;
      this.targetRect = null;
      this.dragReleaseUntil = 0;
      this.setAnimation("drag_hold", null);
      return;
    }

    this.mode = "drag";
    this.behavior = "drag";
    this.offscreen = false;
    this.targetRect = null;
    this.dragReleaseUntil = Date.now() + DRAG_RELEASE_MS;
    this.nextDecisionAt = this.dragReleaseUntil + 300;
    this.setAnimation("drag_release", null);
  }

  getState(): PetMotionState {
    if (this.readerActive) {
      return {
        animation: "read_idle",
        behavior: "read",
        direction: null,
        dragging: false,
        offscreen: false,
        paused: this.paused,
        readerActive: this.readerActive
      };
    }

    return {
      animation: this.animation,
      behavior: this.behavior,
      direction: this.direction,
      dragging: this.userDragging,
      offscreen: this.offscreen,
      paused: this.paused,
      readerActive: this.readerActive
    };
  }

  private tick(): void {
    if (this.window.isDestroyed()) {
      return;
    }

    if (this.userDragging) {
      this.setAnimation("drag_hold", null);
      return;
    }

    if (this.readerActive) {
      this.window.setOpacity(1);
      this.behavior = "read";
      this.offscreen = false;
      this.setAnimation("read_idle", null);
      return;
    }

    if (this.paused) {
      this.window.setOpacity(1);
      this.behavior = "rest";
      this.offscreen = false;
      this.setAnimation("idle", null);
      return;
    }

    const now = Date.now();

    if (this.mode === "drag" && now < this.dragReleaseUntil) {
      this.setAnimation("drag_release", null);
      return;
    }

    if (now >= this.nextDecisionAt) {
      this.chooseNextAction(now);
    }

    if (this.mode === "rest" || this.mode === "hidden") {
      return;
    }

    if (this.mode === "roam" || this.mode === "popout") {
      this.stepTowardCurrentTarget();
    }
  }

  private chooseNextAction(now: number): void {
    const behavior = this.forceInitialPopout ? "popout" : chooseWeightedBehavior();
    this.forceInitialPopout = false;
    const rect = this.window.getBounds();
    const bounds = this.getCurrentWorkArea(rect);
    const durationMs = chooseBehaviorDurationMs(behavior);

    this.behavior = behavior;
    this.targetRect = null;

    if (behavior === "rest") {
      const placement = chooseRestPlacement(rect, bounds);
      this.mode = "rest";
      this.offscreen = placement.offscreen;
      this.window.setOpacity(1);
      this.window.setBounds(roundRect(placement.rect), false);
      this.nextDecisionAt = now + durationMs;
      this.setAnimation(placement.animation, placement.direction);
      return;
    }

    if (behavior === "roam") {
      this.mode = "roam";
      this.offscreen = false;
      this.roamUsesRun = Math.random() < 0.45;
      this.targetRect = chooseRoamTarget(rect, bounds);
      this.window.setOpacity(1);
      this.nextDecisionAt = now + durationMs;
      this.stepTowardCurrentTarget();
      return;
    }

    if (behavior === "hidden") {
      this.mode = "hidden";
      this.offscreen = true;
      this.window.setBounds(roundRect(chooseHiddenRect(rect, bounds)), false);
      this.window.setOpacity(0.04);
      this.nextDecisionAt = now + durationMs;
      this.setAnimation("hide", null);
      return;
    }

    const placement = choosePopoutPlacement(rect, bounds);
    this.mode = "popout";
    this.offscreen = true;
    this.roamUsesRun = true;
    this.targetRect = placement.target;
    this.window.setOpacity(1);
    this.window.setBounds(roundRect(placement.start), false);
    this.nextDecisionAt = now + durationMs;
    this.setAnimation(placement.animation, placement.direction);
  }

  private stepTowardCurrentTarget(): void {
    if (!this.targetRect) {
      return;
    }

    const rect = this.window.getBounds();
    const speed = this.mode === "popout" ? POPOUT_SPEED : this.roamUsesRun ? RUN_SPEED : ROAM_SPEED;
    const step = stepTowardTarget(rect, this.targetRect, speed);
    const nextRect =
      this.mode === "popout"
        ? step.rect
        : clampSoftly(step.rect, this.getCurrentWorkArea(rect));
    const animation =
      this.mode === "popout"
        ? this.animation
        : getMovementAnimation(step.direction, this.roamUsesRun ? "run" : "walk");

    this.window.setBounds(roundRect(nextRect), false);
    this.offscreen = this.mode === "popout" && !step.arrived;
    this.setAnimation(animation, step.direction);

    if (step.arrived) {
      this.nextDecisionAt = Date.now();
    }
  }

  private setAnimation(
    animation: PetAnimationState,
    direction: PetDirection | null
  ): void {
    const changed = this.animation !== animation || this.direction !== direction;

    this.animation = animation;
    this.direction = direction;

    if (changed) {
      this.emitState();
    }
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

function clampSoftly(rect: Rect, bounds: Rect): Rect {
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width - rect.width),
    y: Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height - rect.height)
  };
}
