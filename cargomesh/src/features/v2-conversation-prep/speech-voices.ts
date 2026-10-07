export type AvailableSpeechVoice = { voiceURI: string; name: string; lang: string; localService: boolean };

export function voicesForLanguage<T extends AvailableSpeechVoice>(voices: T[], language: "es-PE" | "en-US"): T[] {
  const family = language.slice(0, 2).toLowerCase();
  return voices.filter((voice) => voice.lang.toLowerCase().startsWith(family))
    .sort((a, b) => scoreVoice(b, language) - scoreVoice(a, language) || a.name.localeCompare(b.name));
}

function scoreVoice(voice: AvailableSpeechVoice, language: string): number {
  const locale = voice.lang.toLowerCase();
  return (voice.localService ? 4 : 0)
    + (locale === language.toLowerCase() ? 3 : 0)
    + (/natural|neural|enhanced|premium/i.test(voice.name) ? 2 : 0)
    + (language === "es-PE" && locale === "es-mx" ? 1 : 0);
}

export function chosenSpeechVoice<T extends AvailableSpeechVoice>(voices: T[], language: "es-PE" | "en-US", selectedVoiceURI: string): T | null {
  const matching = voicesForLanguage(voices, language);
  return matching.find((voice) => voice.voiceURI === selectedVoiceURI) ?? matching[0] ?? null;
}
