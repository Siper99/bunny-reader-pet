# Pet Animation Frames

Runtime frames live in one folder per animation state:

```text
public/pet/animations/<state>/<frame>.png
```

Rules:

- Every frame is a transparent `236x342` PNG.
- Filenames are zero-padded: `000.png`, `001.png`, `002.png`.
- Frame lists, fps, looping, and hitboxes are defined in `public/pet/manifest.json`.
- Bump `assetVersion` in the manifest when replacing frames with the same names.

Current state groups:

```text
idle
rest_corner
walk_left / walk_right / walk_up / walk_down
run_left / run_right / run_up / run_down
drag_hold / drag_release
peek_left / peek_right
hide
popout_left / popout_right / popout_top / popout_bottom
read_idle
tap_happy / tap_annoyed
enter / exit
```

The current PNG set is a procedural first pass for behavior development. It is
safe to replace any state folder with hand-drawn frames later as long as the
manifest frame list is kept in sync.
