export function recognitionErrorMessage(code: string | undefined): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone or speech-service permission was denied. Allow it in browser settings, or type your message.";
    case "audio-capture":
      return "No working microphone was found. Check the device and browser input settings, or type your message.";
    case "network":
      return "The browser's speech recognition service could not connect. Check your connection or type your message.";
    case "no-speech":
      return "I did not hear speech. Try again near the microphone, or type your message.";
    case "language-not-supported":
      return "This browser cannot recognize English speech. You can type every step.";
    case "aborted":
      return "Listening stopped. Review any transcript or type your message.";
    default:
      return "Speech recognition stopped unexpectedly. Check microphone access or type your message.";
  }
}

export function recognitionEndMessage(hasTranscript: boolean): string {
  return hasTranscript
    ? "Listening ended. Review or edit the transcript, then press Send. Nothing was sent automatically."
    : "Listening ended without a transcript. The browser may have stopped its speech service; try again or type your message.";
}
