export type BrowserSpeechSupport = { mode: "remote" | "local" | "unsupported"; message: string };

export function resolveBrowserSpeechSupport(input: {
  hasRecognition: boolean;
  isBrave: boolean;
  localAvailability?: string | null;
}): BrowserSpeechSupport {
  if (!input.hasRecognition) return {
    mode: "unsupported",
    message: "Speech recognition is unavailable in this browser. You can type every step.",
  };
  if (!input.isBrave) return { mode: "remote", message: "" };
  if (input.localAvailability === "available") return { mode: "local", message: "" };
  return {
    mode: "unsupported",
    message: "This Brave installation exposes a speech button but has no available English recognition engine. Your microphone may work in other services. Use text here or a browser with working Web Speech; Alexa+ voice is a separate channel.",
  };
}
