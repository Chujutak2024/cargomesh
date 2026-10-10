/** Wrap scenery only beyond the visible roadside. Retains continuity on resume. */
export function roadPositionAt(start: number, distance: number) {
  return ((start + distance + 40) % 80 + 80) % 80 - 40;
}
