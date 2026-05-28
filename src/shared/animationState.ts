import type { PetAnimationState, PetManifest } from "./types";

export interface ResolveAnimationInput {
  motionState: PetAnimationState;
  readerActive: boolean;
  overrideState: PetAnimationState | null;
}

export function resolveAnimationState({
  motionState,
  readerActive,
  overrideState
}: ResolveAnimationInput): PetAnimationState {
  if (overrideState) {
    return overrideState;
  }

  if (readerActive) {
    return "read_idle";
  }

  return motionState;
}

export function pickTapReaction(random = Math.random): PetAnimationState {
  return random() < 0.76 ? "tap_happy" : "tap_annoyed";
}

export function getAnimationDefinition(
  manifest: PetManifest | null,
  state: PetAnimationState
) {
  if (!manifest) {
    return null;
  }

  return (
    manifest.states[state] ??
    manifest.states[manifest.fallbackState] ??
    manifest.states.idle
  );
}

export function getAnimationDurationMs(
  manifest: PetManifest | null,
  state: PetAnimationState,
  fallbackMs = 900
): number {
  const definition = getAnimationDefinition(manifest, state);
  if (!definition || definition.loop) {
    return fallbackMs;
  }

  return Math.max((definition.frames.length / definition.fps) * 1000, 200);
}
