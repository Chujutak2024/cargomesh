export type VoiceTurn = {
  speaker: "user" | "assistant";
  text: string;
  contentId?: string;
  provisional?: boolean;
};

export function applyVoiceTranscript(
  turns: VoiceTurn[],
  update: { role: "user" | "assistant"; contentId: string; text: string; final: boolean },
): VoiceTurn[] {
  if (!update.contentId || !update.text || update.text.length > 4096) return turns;
  const index = turns.findIndex((turn) => turn.contentId === update.contentId && turn.speaker === update.role);
  if (index < 0) {
    return [...turns, {
      speaker: update.role, text: update.text, contentId: update.contentId, provisional: !update.final,
    }];
  }
  const prior = turns[index];
  if (!prior.provisional && !update.final) return turns;
  const text = update.final ? update.text : prior.text + update.text;
  if (text.length > 4096) return turns;
  return turns.map((turn, at) => at === index ? { ...turn, text, provisional: !update.final } : turn);
}
