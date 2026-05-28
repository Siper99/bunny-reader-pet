Put transparent frame PNGs in the state folder that matches the animation.

Source sheet for the current character direction:

```text
public/assets/main-character/bunny-girl-spritesheet-v2.png
```

Expected frame layout:

```text
enter/000.png ... enter/002.png
exit/000.png ... exit/002.png
idle/000.png ... idle/008.png
read_idle/000.png ... read_idle/007.png
walk_left/000.png ... walk_left/004.png
walk_right/000.png ... walk_right/004.png
tap_happy/000.png ... tap_happy/005.png
tap_annoyed/000.png ... tap_annoyed/005.png
```

Export rules:

- Export each frame as a transparent PNG.
- Keep every frame canvas at `236x342`.
- Keep the character horizontally centered and bottom aligned.
- Do not include the dark sheet background, dotted guide lines, blue floor glow,
  or gold title labels in exported frames.
- Use zero-padded filenames such as `000.png`, `001.png`, `002.png`.
- If you change the frame count, update the matching `frames` list in
  `public/pet/manifest.json`.
- When replacing frames without renaming them, bump `assetVersion` in
  `public/pet/manifest.json` so the app does not show cached images.
