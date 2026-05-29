export type PetAnimationState =
  | "idle"
  | "rest_corner"
  | "walk_up"
  | "walk_down"
  | "walk_left"
  | "walk_right"
  | "run_up"
  | "run_down"
  | "run_left"
  | "run_right"
  | "enter"
  | "exit"
  | "drag_hold"
  | "drag_release"
  | "peek_left"
  | "peek_right"
  | "hide"
  | "popout_left"
  | "popout_right"
  | "popout_top"
  | "popout_bottom"
  | "tap_happy"
  | "tap_annoyed"
  | "read_idle";

export type PetBehaviorMode =
  | "rest"
  | "roam"
  | "hidden"
  | "popout"
  | "drag"
  | "read";

export type PetDirection = "left" | "right" | "up" | "down";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface AnimationHitbox extends Rect {}

export interface AnimationDefinition {
  fps: number;
  loop: boolean;
  framesPath: string;
  frames: string[];
  size: Size;
  anchor: Point;
  hitbox: AnimationHitbox;
}

export interface PetManifest {
  assetVersion?: string;
  defaultState: PetAnimationState;
  fallbackState: PetAnimationState;
  states: Partial<Record<PetAnimationState, AnimationDefinition>>;
}

export interface NovelPayload {
  title: string;
  sourceUrl: string;
  text: string;
  lines: string[];
}

export interface ReaderSnapshot extends NovelPayload {
  index: number;
  autoPlay: boolean;
  speedMs: number;
}

export interface PetMotionState {
  animation: PetAnimationState;
  behavior: PetBehaviorMode;
  direction: PetDirection | null;
  dragging: boolean;
  offscreen: boolean;
  paused: boolean;
  readerActive: boolean;
}
