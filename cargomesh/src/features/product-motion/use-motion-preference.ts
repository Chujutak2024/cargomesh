"use client";
import { useState, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(change: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
const snapshot = () => window.matchMedia(query).matches;
// React uses this same snapshot on the server and during client hydration.
const serverSnapshot = () => true;
export function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Automatic playback respects the system; a deliberate Play click opts in for this scene only. */
export function useScenePlayback() {
  const preferred = useReducedMotionPreference();
  const [requested, setRequested] = useState<boolean | null>(null);
  const playing = requested ?? !preferred;
  return { playing, toggle: () => setRequested(!playing) };
}
