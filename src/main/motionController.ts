import { BrowserWindow, screen } from "electron";
import {
  chooseBehaviorDurationMs,
  chooseRestPlacement,
  chooseRoamTarget,
  chooseWeightedBehavior,
  clampWindowToBounds,
  edgeEntry,
  edgeExitTarget,
  getMovementAnimation,
  stepTowardTarget,
  type ScreenEdge,
  type Velocity
} from "../shared/petMotion";
import { stepProjectile } from "../shared/throwPhysics";
import type {
  PetAnimationState,
  PetBehaviorMode,
  PetDirection,
  PetMotionState,
  Rect
} from "../shared/types";

type MotionMode =
  | "rest"
  | "roam"
  | "hidden"
  | "popout"
  | "drag"
  | "exiting"
  | "entering"
  | "thrown"
  | "fallen";

const TICK_MS = 80;
const DRAG_RELEASE_MS = 650;
const ROAM_SPEED = 5.8;
const RUN_SPEED = 9.6;
const POPOUT_SPEED = 12;
/** How long the pet stays put looking dizzy after a spin (matches renderer). */
const DIZZY_HOLD_MS = 2500;
/** Throw physics runs on its own ~60fps timer so the arc looks smooth. */
const THROW_TICK_MS = 16;
const GRAVITY = 0.22; // px per throw-tick²
const LAUNCH_SCALE = 0.6; // scales release px/ms → px/throw-tick launch speed
const MAX_LAUNCH = 36; // clamp per-axis launch speed (px/throw-tick)
const FALL_LIE_MS = 900; // time lying down after landing
const GETUP_MS = 420; // time getting back up
const THROW_RECOVERY_HOLD_MS = 2200; // stay selectable after getting up

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
  private dragReleaseUntil = 0;
  private roamUsesRun = false;
  /**
   * Fixed edge the pet always disappears through and re-appears from, so the
   * coming/going always follows the same predictable path (the right edge).
   */
  private readonly exitEdge: ScreenEdge = "right";
  /** True while the pet is hidden by an explicit user action (tray "隐藏"). */
  private hiddenByUser = false;
  /** Distinguishes a user hide (window.hide + freeze) from an autonomous one. */
  private exitIsUserHide = false;
  /** How long an autonomous hide stays offscreen before walking back in. */
  private hiddenHoldMs = 0;
  /** Pending "walk to a rest spot, then idle there" bookkeeping. */
  private pendingRest = false;
  private pendingRestAnimation: PetAnimationState = "rest_corner";
  private pendingRestDirection: PetDirection | null = null;
  private restHoldMs = 0;
  /** Timestamp until which the pet stays still, dizzy after a vigorous spin. */
  private dizzyUntil = 0;
  /** Dedicated high-frequency timer + state for the throw arc. */
  private physicsTimer: NodeJS.Timeout | null = null;
  private throwVelocity: Velocity = { x: 0, y: 0 };
  /** Timestamps controlling the fall → get-up recovery after landing. */
  private fallenUntil = 0;
  private getupUntil = 0;

  constructor(private readonly window: BrowserWindow) {}

  start(): void {
    this.stop();
    this.window.setOpacity(1);
    this.nextDecisionAt = Date.now();
    this.offscreen = true;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopPhysics();
  }

  private stopPhysics(): void {
    if (this.physicsTimer) {
      clearInterval(this.physicsTimer);
      this.physicsTimer = null;
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
      this.stopPhysics();
      this.throwVelocity = { x: 0, y: 0 };
      this.fallenUntil = 0;
      this.getupUntil = 0;
      this.dizzyUntil = 0;
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

  /**
   * Hold the pet still for a moment after the user spun it dizzy. The dizzy
   * animation itself is shown by the renderer (override state); here we just
   * make sure the autonomous loop doesn't walk the pet off mid-dizzy.
   */
  setDizzy(): void {
    this.dizzyUntil = Date.now() + DIZZY_HOLD_MS;
  }

  /**
   * Fling the pet with a release velocity (px/ms, from the renderer). It then
   * follows a gravity arc, bounces off walls, and falls over when it lands.
   */
  throwFrom(velocityXPerMs: number, velocityYPerMs: number): void {
    if (this.window.isDestroyed()) {
      return;
    }

    this.window.setOpacity(1);
    this.dizzyUntil = 0;
    this.userDragging = false;
    this.targetRect = null;
    this.mode = "thrown";
    this.behavior = "drag";
    this.offscreen = false;
    this.throwVelocity = {
      x: clamp(velocityXPerMs * THROW_TICK_MS * LAUNCH_SCALE, -MAX_LAUNCH, MAX_LAUNCH),
      y: clamp(velocityYPerMs * THROW_TICK_MS * LAUNCH_SCALE, -MAX_LAUNCH, MAX_LAUNCH)
    };
    this.setAnimation("drag_release", this.throwVelocity.y < 0 ? "up" : "down");

    // Run the arc on a dedicated ~60fps timer so it doesn't look choppy.
    this.stopPhysics();
    this.physicsTimer = setInterval(() => this.stepThrow(), THROW_TICK_MS);
  }

  private stepThrow(): void {
    if (this.window.isDestroyed()) {
      this.stopPhysics();
      return;
    }

    const rect = this.window.getBounds();
    const bounds = this.getCurrentWorkArea(rect);
    const step = stepProjectile(rect, this.throwVelocity, bounds, GRAVITY);

    this.throwVelocity = step.velocity;
    this.window.setBounds(roundRect(step.rect), false);

    // Flail through the air: face the way we're heading vertically.
    const airborne: PetAnimationState =
      step.velocity.y < 0 ? "run_up" : "run_down";
    this.setAnimation(airborne, step.velocity.y < 0 ? "up" : "down");

    if (step.landed) {
      this.stopPhysics();
      const now = Date.now();
      this.fallenUntil = now + FALL_LIE_MS;
      this.getupUntil = this.fallenUntil + GETUP_MS;
      this.mode = "fallen";
      this.behavior = "rest";
      this.offscreen = false;
      this.setAnimation("fall", null);
    }
  }

  private stepFallen(): void {
    const now = Date.now();

    if (now < this.fallenUntil) {
      this.setAnimation("fall", null);
      return;
    }

    if (now < this.getupUntil) {
      this.setAnimation("getup", null);
      return;
    }

    // Recovered — hand back to the autonomous behaviour scheduler.
    this.mode = "rest";
    this.behavior = "rest";
    this.nextDecisionAt = now + THROW_RECOVERY_HOLD_MS;
    this.setAnimation("idle", null);
  }

  /**
   * Explicit hide: walk out through the fixed exit edge, then hide the window.
   * Reverses the old "instant vanish" behaviour.
   */
  exitToEdge(): void {
    if (this.window.isDestroyed() || this.mode === "exiting") {
      return;
    }
    this.startExit(true, 0);
  }

  /**
   * Explicit show: walk the pet back in through the same edge it left from.
   * No-op if it is already visible and not user-hidden.
   */
  enterFromEdge(): void {
    if (this.window.isDestroyed()) {
      return;
    }

    if (!this.hiddenByUser && this.window.isVisible() && this.mode !== "exiting") {
      this.window.focus();
      return;
    }

    this.startEnter();
  }

  /**
   * Begins a smooth walk out through the fixed exit edge.
   * @param userHide  true → window.hide() + freeze on arrival (tray hide);
   *                  false → stay offscreen for `holdMs`, then walk back in.
   */
  private startExit(userHide: boolean, holdMs: number): void {
    this.window.setOpacity(1);
    if (!this.window.isVisible()) {
      this.window.show();
    }

    const rect = this.window.getBounds();
    const bounds = this.getCurrentWorkArea(rect);
    const { target, direction } = edgeExitTarget(rect, bounds, this.exitEdge);

    this.exitIsUserHide = userHide;
    this.hiddenHoldMs = holdMs;
    this.hiddenByUser = false;
    this.userDragging = false;
    this.mode = "exiting";
    this.behavior = "hidden";
    this.offscreen = false;
    this.targetRect = target;
    this.roamUsesRun = userHide; // tray hide trots out; autonomous strolls
    this.setAnimation(
      getMovementAnimation(direction, userHide ? "run" : "walk"),
      direction
    );

    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
  }

  /** Begins a smooth walk in through the fixed exit edge. */
  private startEnter(): void {
    const base = this.window.getBounds();
    const bounds = this.getCurrentWorkArea(base);
    const placement = edgeEntry(base, bounds, this.exitEdge);

    this.hiddenByUser = false;
    this.userDragging = false;
    this.mode = "entering";
    this.behavior = "popout";
    this.offscreen = true;
    this.targetRect = placement.target;

    this.window.setOpacity(1);
    this.window.setBounds(roundRect(placement.start), false);
    this.window.show();
    this.setAnimation(placement.animation, placement.direction);

    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
  }

  private stepExit(): void {
    if (!this.targetRect) {
      this.finishExit();
      return;
    }

    const rect = this.window.getBounds();
    const speed = this.roamUsesRun ? RUN_SPEED : ROAM_SPEED;
    const step = stepTowardTarget(rect, this.targetRect, speed);
    this.window.setBounds(roundRect(step.rect), false);
    this.setAnimation(
      getMovementAnimation(step.direction, this.roamUsesRun ? "run" : "walk"),
      step.direction
    );

    if (step.arrived) {
      this.finishExit();
    }
  }

  private finishExit(): void {
    this.targetRect = null;
    this.mode = "hidden";
    this.behavior = "hidden";
    this.offscreen = true;

    if (this.exitIsUserHide) {
      // Tray hide: actually hide the window and freeze until the user shows it.
      this.hiddenByUser = true;
      this.window.hide();
      return;
    }

    // Autonomous hide: rest offscreen, then walk back in from the same edge.
    this.nextDecisionAt = Date.now() + this.hiddenHoldMs;
  }

  private stepEnter(): void {
    if (!this.targetRect) {
      this.finishEnter();
      return;
    }

    const rect = this.window.getBounds();
    const step = stepTowardTarget(rect, this.targetRect, POPOUT_SPEED);
    this.window.setBounds(roundRect(step.rect), false);
    this.offscreen = !step.arrived;

    if (step.arrived) {
      this.finishEnter();
    }
  }

  private finishEnter(): void {
    this.targetRect = null;
    this.mode = "rest";
    this.behavior = "rest";
    this.offscreen = false;
    // Hand control back to the autonomous behaviour scheduler immediately.
    this.nextDecisionAt = Date.now();
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

    // Frozen offscreen after an explicit hide — wait for enterFromEdge().
    if (this.hiddenByUser) {
      return;
    }

    // Explicit, user-driven edge transitions take priority over everything.
    if (this.mode === "exiting") {
      this.stepExit();
      return;
    }

    if (this.mode === "entering") {
      this.stepEnter();
      return;
    }

    // The throw arc is driven by its own physics timer; nothing to do here.
    if (this.mode === "thrown") {
      return;
    }

    if (this.mode === "fallen") {
      this.stepFallen();
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

    // Stay put while dizzy (the renderer override shows the dizzy animation).
    if (Date.now() < this.dizzyUntil) {
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
    const rect = this.window.getBounds();
    const bounds = this.getCurrentWorkArea(rect);

    // Offscreen (just finished a hide, or the very first spawn) → always walk
    // back in through the fixed edge. Never pop in at a random spot.
    if (this.offscreen) {
      this.startEnter();
      return;
    }

    const behavior = chooseWeightedBehavior();
    const durationMs = chooseBehaviorDurationMs(behavior);
    this.behavior = behavior;
    this.targetRect = null;
    this.pendingRest = false;

    if (behavior === "hidden") {
      // Walk out through the fixed edge and stay hidden for the duration.
      this.startExit(false, durationMs);
      return;
    }

    if (behavior === "roam") {
      this.mode = "roam";
      this.offscreen = false;
      this.roamUsesRun = Math.random() < 0.45;
      this.targetRect = chooseRoamTarget(rect, bounds);
      this.window.setOpacity(1);
      this.nextDecisionAt = now + durationMs;
      return;
    }

    // behavior === "rest": walk to a resting spot, then idle there (no jump).
    const placement = chooseRestPlacement(rect, bounds);
    this.mode = "roam";
    this.offscreen = false;
    this.roamUsesRun = false;
    this.pendingRest = true;
    this.pendingRestAnimation = placement.animation;
    this.pendingRestDirection = placement.direction;
    this.restHoldMs = durationMs;
    this.targetRect = clampWindowToBounds(placement.rect, bounds);
    this.window.setOpacity(1);
    // Far future; the real rest timer starts once we arrive (onRoamArrived).
    this.nextDecisionAt = now + durationMs + 60000;
  }

  private stepTowardCurrentTarget(): void {
    if (!this.targetRect) {
      return;
    }

    const rect = this.window.getBounds();
    const bounds = this.getCurrentWorkArea(rect);
    const speed = this.roamUsesRun ? RUN_SPEED : ROAM_SPEED;
    const step = stepTowardTarget(rect, this.targetRect, speed);

    this.window.setBounds(roundRect(clampSoftly(step.rect, bounds)), false);
    this.offscreen = false;
    this.setAnimation(
      getMovementAnimation(step.direction, this.roamUsesRun ? "run" : "walk"),
      step.direction
    );

    if (step.arrived) {
      this.onRoamArrived();
    }
  }

  private onRoamArrived(): void {
    this.targetRect = null;
    const now = Date.now();

    if (this.pendingRest) {
      this.pendingRest = false;
      this.mode = "rest";
      this.behavior = "rest";
      this.offscreen = false;
      this.setAnimation(this.pendingRestAnimation, this.pendingRestDirection);
      this.nextDecisionAt = now + this.restHoldMs;
      return;
    }

    // Finished a roam leg → decide again immediately.
    this.nextDecisionAt = now;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
