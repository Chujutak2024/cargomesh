# Carrier request review explainer

Six-second optional HyperFrames illustration; not live request progress. Uses the current Carrier colors and Arial. The app only loads it when its disclosure is opened, with native controls and no autoplay. Static text remains available.

## Reproduce

With Node 22+ and FFmpeg available, from this folder:

```sh
npx --yes hyperframes@0.8.154 check
npx --yes hyperframes@0.8.154 render --output ../../public/carrier-media/request-review-flow.mp4 --quality standard --fps 30 --workers 1
ffmpeg -ss 4 -i ../../public/carrier-media/request-review-flow.mp4 -frames:v 1 ../../public/carrier-media/request-review-flow-poster.png
```

GSAP 3.14.2 is vendored for deterministic offline authoring; its original copyright/license URL remains in assets/gsap.min.js and upstream README in assets/GSAP-README.md. HyperFrames is an authoring CLI, not a product runtime dependency.

Check: runtime 0 errors, layout 0 issues, motion 0 errors, contrast 53/53 PASS. One structural Studio warning: the single scene contains nested divs. This is intentional for this one-scene six-second composition; no scene transitions or sub-compositions are needed. General product validation remains scheduled for October 21.
