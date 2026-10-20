# CargoMesh request review explainer

## Style Prompt
Use the existing CargoMesh Carrier visual identity from the user's compact record reference: a light operational sheet, navy text, teal accents and pale blue surfaces. Explain the three stages without implying that the displayed request was accepted, quoted or booked. One six-second scene, no narration, optional user-initiated playback inside a disclosure.

## Colors
- Canvas #edf3f9
- Surface #ffffff
- Text #163349
- Muted text #4d657b
- Accent #00747c

## Typography
Arial, matching the current Carrier shell. Clear horizontal stages; no technical IDs in the video.

## Motion
Six seconds at 30 fps. Deterministic GSAP timeline registered to HyperFrames. Stages enter progressively and hold. The product does not autoplay the video; play/pause/seek use native video controls. The composition is illustrative, not live progress.

## What NOT to Do
- No fabricated price, resource availability or customer identity.
- No large decorative video above the request information.
- No infinite timeline, camera shake or autonomous animation clock.
- No interface controls baked into the render.
