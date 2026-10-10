/** Ends one voice turn after a pause. A manual stop discards the pending auto-send. */
export function createSpeechTurnDetector(
  onTurn: (transcript: string) => void,
  delayMs = 1400,
  clock: { schedule: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>; clear: (timer: ReturnType<typeof setTimeout>) => void } = {
    schedule: (callback, ms) => setTimeout(callback, ms),
    clear: (timer) => clearTimeout(timer),
  },
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let transcript = "";
  let settled = false;
  const clear = () => { if (timer) clock.clear(timer); timer = null; };
  const finish = () => {
    if (settled || !transcript) return;
    settled = true;
    clear();
    onTurn(transcript);
  };
  return {
    update(value: string) {
      if (settled || !value.trim()) return;
      transcript = value.trim();
      clear();
      timer = clock.schedule(finish, delayMs);
    },
    finish,
    cancel() { settled = true; clear(); },
    hasTranscript() { return Boolean(transcript); },
  };
}
