/** Renew a bounded provider connection only while someone is actively conversing. */
export function shouldRenewVoiceSession(startedAt: number, lastUserTurnAt: number, now: number): boolean {
  return startedAt > 0 && lastUserTurnAt >= startedAt
    && now - startedAt >= 180_000 && now - lastUserTurnAt <= 210_000;
}
