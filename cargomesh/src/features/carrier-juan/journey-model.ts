/** Presentation fixtures for the authorized demo. Never GPS, dispatch or booking state. */
export const journeyProfiles = [
  { progress: .87, minutes: 720, departure: 348, delay: 18, alternative: 31 },
  { progress: .48, minutes: 840, departure: 420, delay: 0, alternative: 16 },
  { progress: .26, minutes: 1080, departure: 390, delay: 24, alternative: 20 },
  { progress: .67, minutes: 660, departure: 480, delay: 8, alternative: 12 },
  { progress: .94, minutes: 480, departure: 540, delay: 0, alternative: 9 },
  { progress: .38, minutes: 540, departure: 450, delay: 12, alternative: 17 },
  { progress: .12, minutes: 780, departure: 510, delay: 0, alternative: 15 },
] as const;
export function journeyProfile(id: string) {
  const number = id.match(/(?:DEMO|LOCAL)-(\d+)$/)?.[1];
  return journeyProfiles[Math.max(0, Math.min(6, Number(number ?? 1) - 1))];
}
export function journeySnapshot(id: string, elapsedSeconds = 0, inactive = false) {
  const profile = journeyProfile(id);
  const progress = Math.min(.995, profile.progress + (inactive ? 0 : Math.max(0, elapsedSeconds) * .000035));
  const remaining = Math.max(1, Math.round(profile.minutes * (1 - progress) + profile.delay));
  return { ...profile, progress, remaining, stage: progress >= .8 ? 3 : progress >= .5 ? 2 : progress >= .22 ? 1 : 0,
    status: inactive ? "Detenido" : progress >= .8 ? "Próximo a llegar" : progress >= .4 ? "En carretera" : "En salida" };
}
export function journeyTime(minutes: number) {
  const value = Math.round(minutes);
  return `${String(Math.floor(value / 60) % 24).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function durationLabel(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
