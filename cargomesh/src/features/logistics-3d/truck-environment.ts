export type TruckEnvironmentPhase = "day" | "afternoon" | "night";

export type TruckEnvironment = {
  phase: TruckEnvironmentPhase;
  /** 0: day, 1: sunset, 2: night. The automatic mode blends between them. */
  blend: number;
  skyTop: string;
  skyHorizon: string;
  land: string;
  hills: string;
  foliage: string;
  sun: string;
  ambient: number;
  key: number;
  fill: number;
  night: number;
};

const palettes = [
  { skyTop: "#2389cf", skyHorizon: "#c2e2ef", land: "#5e965d", hills: "#5b9c88", foliage: "#34754d", sun: "#fff6d6", ambient: .65, key: 2.6, fill: 1.25 },
  { skyTop: "#7b79ad", skyHorizon: "#ffb77d", land: "#85874b", hills: "#8d839a", foliage: "#576d3e", sun: "#ffd292", ambient: .5, key: 1.9, fill: 1 },
  { skyTop: "#08132b", skyHorizon: "#152e52", land: "#3b5156", hills: "#30435b", foliage: "#354e48", sun: "#deedff", ambient: .32, key: .65, fill: .85 },
] as const;

/** Uses the device's local clock. This is visual lighting, not route weather. */
export function environmentBlendAt(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized < 5 || normalized >= 20) return 2;
  if (normalized < 7) return 2 * (7 - normalized) / 2;
  if (normalized < 16) return 0;
  if (normalized < 18) return (normalized - 16) / 2;
  return 1 + (normalized - 18) / 2;
}

function mixColor(first: string, second: string, amount: number) {
  const start = parseInt(first.slice(1), 16), end = parseInt(second.slice(1), 16);
  const channel = (shift: number) => Math.round(((start >> shift) & 255) * (1 - amount) + ((end >> shift) & 255) * amount);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}

export function getTruckEnvironment(date: Date): TruckEnvironment {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const phase = hour >= 6 && hour < 16 ? "day" : hour >= 16 && hour < 19 ? "afternoon" : "night";
  const blend = environmentBlendAt(hour);
  const from = palettes[Math.floor(blend)], to = palettes[Math.min(Math.floor(blend) + 1, 2)], amount = blend % 1;
  const number = (key: "ambient" | "key" | "fill") => from[key] * (1 - amount) + to[key] * amount;
  const color = (key: "skyTop" | "skyHorizon" | "land" | "hills" | "foliage" | "sun") => mixColor(from[key], to[key], amount);
  return { phase, blend, night: Math.max(0, blend - 1), ambient: number("ambient"), key: number("key"), fill: number("fill"),
    skyTop: color("skyTop"), skyHorizon: color("skyHorizon"), land: color("land"), hills: color("hills"), foliage: color("foliage"), sun: color("sun") };
}

export function nextEnvironmentPhase(phase: TruckEnvironmentPhase): TruckEnvironmentPhase {
  return phase === "day" ? "afternoon" : phase === "afternoon" ? "night" : "day";
}

/** A local preview; reloading resumes the device clock. */
export function previewTruckEnvironment(phase: TruckEnvironmentPhase): TruckEnvironment {
  return getTruckEnvironment(new Date(2000, 0, 1, phase === "day" ? 12 : phase === "afternoon" ? 18 : 22));
}

/** Fixed world coordinates. Orbiting the truck must never drag the sun or moon. */
export function celestialDirection(environment: Pick<TruckEnvironment, "blend">): [number, number, number] {
  const elevation = environment.blend <= 1 ? .17 - environment.blend * .09 : .08 + (environment.blend - 1) * .09;
  const vector: [number, number, number] = [.58, elevation, -.82];
  const length = Math.hypot(...vector);
  return vector.map(value => value / length) as [number, number, number];
}
