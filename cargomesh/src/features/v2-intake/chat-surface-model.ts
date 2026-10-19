export type FloatingPoint = { x: number; y: number };
export type FloatingBounds = { width: number; height: number; viewportWidth: number; viewportHeight: number };

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
