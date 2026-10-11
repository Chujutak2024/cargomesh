# Google route 3D browser support — 2026-10-10

## Observed
The current native Opera tab renders the normal Google raster map and independent Three.js scene. Google vector loading reported “Attempted to load a Vector Map, but failed. Falling back to Raster.” and “The map is not a vector map, which will prevent use of WebGLOverlayView.” A vector-only route view would leave a loading screen.

## Resolution
Keep the same Google Maps/Routes provider, existing key and returned path. Render Google's raster tile/route layer in a tilted, heading-following perspective; render the truck with a separate transparent Three.js canvas. Google's logo/copyright sibling remains outside the transformed visual layer. Do not change browser security flags or add a different provider as fallback. Missing geometry, key, model or authentication remains an explicit unavailable state.

## Scope and limitation
This is a route visualisation with a 3D truck and map perspective, not GPS telemetry or a photorealistic 3D reconstruction of the route. Heading follows the returned polyline. The Google DOM layer selector should be rechecked if the Maps JS layout changes. The existing 2D map remains available.

## Verification
Typecheck and complete production build passed. Desktop and mobile 412×915 show the truck, map perspective, declared route and readable Google logo/conditions. The animated distance advances with changing geographic coordinates. Main-route and truck-summary entries, return to 2D map and focus restoration verified. No new vector failures in the raster implementation.
