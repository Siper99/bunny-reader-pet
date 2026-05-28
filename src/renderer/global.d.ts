import type { BunnyPetApi } from "../preload/preload";

declare global {
  interface Window {
    bunnyPet: BunnyPetApi;
  }
}

export {};
