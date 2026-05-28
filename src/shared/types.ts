export type PetAnimationState =
  | "idle"
  | "walk_left"
  | "walk_right"
  | "enter"
  | "exit"
  | "tap_happy"
  | "tap_annoyed"
  | "read_idle";

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
  states: Record<PetAnimationState, AnimationDefinition>;
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
  paused: boolean;
  readerActive: boolean;
}
