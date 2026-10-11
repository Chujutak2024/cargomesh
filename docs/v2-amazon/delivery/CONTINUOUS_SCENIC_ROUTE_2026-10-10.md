# Continuous scenic route — local UI delivery

## Requested change

Improve the scenic 3D route animation, make travel appear endless and refine environmental graphics. This increment extends `SCENIC_TRACKING_REVIEW_2026-10-10.md`.

## Implementation

- The known provider route drives the initial compressed scenic path. An original continuation joins its endpoint with continuous position and tangent. The truck/camera never reset to the beginning.
- Four 320-unit road sections are retained. The next far section is generated beyond the visible fog; old geometry, materials and textures are disposed. Coordinates are rebased at each section boundary without changing the camera's world position.
- One bounded world-space terrain grid replaces the wide curved terrain strips, which folded at tight bends. Road-adjacent ground stays below the pavement. Terrain is prepared in small frame batches while the prior terrain stays visible. Cancelling/unmounting also cancels preparation.
- Varied trees, palms, shrubs, flowers, rocks, slopes, fences, window frames, doors, pitched roofs, solar panels, rooftop equipment, destination signage and roadside barriers replace the sparse scenery.
- Locally generated texture grain uses mipmaps and anisotropic filtering. The coast has animated water and shore effects. A shader dome supplies an atmospheric sky, slowly drifting clouds, sun/moon and stars. Clock-based lighting refreshes every 30 seconds; its light direction matches the visible celestial direction.
- Camera position/look target and truck orientation use damped movement. Wheels follow accumulated visual travel; suspension movement is subtle. The render target is 60 FPS, with bounded pixel density, hidden-page suspension and reduced-motion handling.

## Data and provenance

Scenery and continuing travel are original presentation art, not surveyed terrain, live GPS or an extended provider route. The separate Google map retains provider geometry and attribution. The scene cursor never changes operational progress, request status, assignments, eligibility or delivery completion. Existing request records, photos/GLB assets and custom truck preferences are preserved. Missing geometry/assets remain unavailable rather than silently substituted. No database, deployment, branch or PR mutation.

## Verification

- 19 focused tests: exact road/lane/UV joins, endpoint continuity, continued travel beyond the route, bounded section replacement over 1,000 boundaries, upward terrain at tight bends, road visibility, shared terrain resource disposal, route provenance and stored request preservation.
- TypeScript, architecture checks and Next production build.
- Native Opera: SOL-0001/coast/curtainsider continued from the original visual path length 2,083.544 to cursor 2,291.908, with 60.0 FPS, four active road chunks and six generated chunks. The operational HUD remained 87%; no completion was written. Live texture counts reached 13 while active sections stayed bounded.
- Mobile 412×915: dialog client/scroll widths are both 394; the complete truck, road guide and HUD remain visible. The temporary viewport override was reset.
- SOL-0005/rigid/city changes the environment and truck correctly; facade windows, doors and rooftop equipment are visible. Cursor2,659.691 exceeds original2,130.319 at60.0FPS with four chunks/six generated and13textures. The HUD remains94%.
- The directory confirms7/7requests and74,600kg, unchanged SOL-0001 dates/weight/Lona lateral and SOL-0007 Mi camión. No console errors were observed. The final SOL-0001 scene was reopened and marked deliverable; its temporary verification viewport is reset.
- Evidence: `D:\Documents\hackaton 2\cargomesh-v2-continuous-scenery-20261010` contains `coast-desktop.png`, `coast-mobile.png`, `city-desktop.png`, `coast-continuity.json`, `build.log` and `tests.log`. Earlier first-pass images are historical, before roof/texture/terrain corrections.

## Source

`cargomesh/src/features/logistics-3d/{route-navigation-3d.tsx,route-navigation.module.css,scenic-route-model.ts,scenic-route-model.test.ts,scenic-route-world.ts,scenic-route-sky.ts}`.
