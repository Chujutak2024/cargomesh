import "server-only";

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

export type SpeechLanguage = "es-PE" | "en-US";

export function speechVoice(language: SpeechLanguage) {
  // Polly has no es-PE voice. Mia is a Latin American Spanish voice.
  return language === "es-PE" ? { voiceId: "Mia" as const, languageCode: "es-MX" as const } : { voiceId: "Joanna" as const, languageCode: "en-US" as const };
}

export async function synthesizeConversationSpeech(text: string, language: SpeechLanguage): Promise<Uint8Array> {
  const client = new PollyClient({ region: process.env.CARGOMESH_POLLY_REGION || "us-east-1", maxAttempts: 1 });
  try {
    const credentials = await client.config.credentials();
    if (!credentials.sessionToken) throw new Error("Temporary IAM credentials required.");
    const voice = speechVoice(language);
    const response = await client.send(new SynthesizeSpeechCommand({
      Engine: "generative", VoiceId: voice.voiceId, LanguageCode: voice.languageCode,
      OutputFormat: "mp3", TextType: "text", Text: text,
    }), { abortSignal: AbortSignal.timeout(8000) });
    if (!response.AudioStream) throw new Error("Polly returned no audio.");
    return response.AudioStream.transformToByteArray();
  } finally {
    client.destroy();
  }
}
