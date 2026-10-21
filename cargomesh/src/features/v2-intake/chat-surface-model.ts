export type FloatingPoint = { x: number; y: number };
export type FloatingBounds = { width: number; height: number; viewportWidth: number; viewportHeight: number };

// One finite hop, then a readable, still greeting before the launcher moves away.
export const ASSISTANT_INTRO_TIMING = { minimumMs: 2100, deadlineMs: 3200 } as const;

const WELCOME_STAGES = {
  mascot: { y: 32, delay: .18 },
  title: { y: 26, delay: .32 },
  greeting: { y: 24, delay: .46 },
} as const;

/** A staggered visual entrance only; never changes message identity or draft state. */
export function assistantWelcomeMotion(stage: keyof typeof WELCOME_STAGES, reduced: boolean) {
  return {
    initial: reduced ? false as const : { opacity: 0, y: WELCOME_STAGES[stage].y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : .64, delay: reduced ? 0 : WELCOME_STAGES[stage].delay, ease: [.22, 1, .36, 1] as const },
  };
}

/** Decorative gaze, bounded inside the face even when the cursor is on another screen edge. */
export function assistantEyeOffset(pointer: FloatingPoint, center: FloatingPoint): FloatingPoint {
  if (![pointer.x, pointer.y, center.x, center.y].every(Number.isFinite)) return { x: 0, y: 0 };
  return { x: Math.tanh((pointer.x - center.x) / 180) * 3.5, y: Math.tanh((pointer.y - center.y) / 180) * 2.5 };
}

/** UI coordinates only. Never stores message text, draft fields or credentials. */
export function clampFloatingPoint(point: FloatingPoint, bounds: FloatingBounds): FloatingPoint {
  const inset = 12;
  return {
    x: Math.max(inset, Math.min(point.x, Math.max(inset, bounds.viewportWidth - bounds.width - inset))),
    y: Math.max(inset, Math.min(point.y, Math.max(inset, bounds.viewportHeight - bounds.height - inset))),
  };
}

export function keyboardFloatingPoint(point: FloatingPoint, key: string, bounds: FloatingBounds, large = false): FloatingPoint | null {
  const delta = large ? 48 : 16;
  const offset = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }[key];
  if (!offset) return null;
  return clampFloatingPoint({ x: point.x + offset[0], y: point.y + offset[1] }, bounds);
}
