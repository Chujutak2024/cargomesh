export type VoiceTurn = {
  speaker: "user" | "assistant";
  text: string;
  contentId?: string;
  provisional?: boolean;
};

export function spokenUserDetails(turns: VoiceTurn[]): string {
  const details: string[] = [];
  for (const turn of turns) {
    if (turn.speaker !== "user" || !turn.contentId?.startsWith("nova:") || turn.provisional) continue;
    const text = turn.text.trim();
    const correction = [...text.matchAll(/\b(?:sorry|actually|correction)\b[,.!\s]*/gi)].at(-1);
    const current = correction && correction.index >= 0 ? text.slice(correction.index + correction[0].length).trim() : text;
    if (!current) continue;
    if (correction && /\bto\b/i.test(current)) {
      for (let index = details.length - 1; index >= 0; index--) {
        if (/\bfrom\b.+\bto\b/i.test(details[index])) details.splice(index, 1);
      }
    }
    details.push(current);
  }
  return details.join("; ");
}

export function recentVoiceContext(turns: VoiceTurn[]): string[] {
  return turns.filter((turn) => turn.speaker === "user" && turn.contentId?.startsWith("nova:") && !turn.provisional)
    .slice(-16).map((turn) => `Customer: ${turn.text.trim().slice(0, 300)}`);
}

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
