export type PlaybackIntent = "auto" | "play" | "pause";
export function shouldPlayPlanet({ intent, reducedMotion, visible, inViewport, blocked, failed }: {
  intent: PlaybackIntent; reducedMotion: boolean; visible: boolean; inViewport: boolean; blocked: boolean; failed: boolean;
}) {
  return visible && inViewport && !blocked && !failed && intent !== "pause" && (intent === "play" || !reducedMotion);
}
