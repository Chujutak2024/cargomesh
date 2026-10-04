"use client";

import { useEffect, useRef, useState } from "react";

type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type RecognitionError = { error?: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export type VoiceState = "checking" | "available" | "requesting_permission" | "listening" | "processing" | "error" | "unsupported";

/** Browser-only capture and playback. It never submits a conversation turn. */
export function useConversationVoice({ onTranscript, responseText }: {
  onTranscript: (text: string) => void;
  responseText: string;
}) {
  const [state, setState] = useState<VoiceState>("checking");
  const [message, setMessage] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    const browser = window as SpeechWindow;
    setState(browser.SpeechRecognition || browser.webkitSpeechRecognition ? "available" : "unsupported");
    return () => {
      recognition.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function stop() {
    stopped.current = true;
    recognition.current?.stop();
    recognition.current = null;
    setState("available");
    setMessage("Listening stopped. Edit the recognized text or continue typing.");
  }

  function start() {
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) {
      setState("unsupported");
      setMessage("Speech recognition is not supported in this browser. Type your message instead.");
      return;
    }
    stopped.current = false;
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "en-US";
    instance.interimResults = false;
    instance.onstart = () => {
      if (stopped.current) return;
      setState("listening");
      setMessage("Listening… Press Stop listening when finished.");
    };
    instance.onresult = (event) => {
      if (stopped.current) return;
      const recognized = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (recognized) onTranscript(recognized);
      setState("processing");
      setMessage("Review or edit the recognized text, then press Send. Nothing was sent automatically.");
    };
    instance.onerror = (event) => {
      if (stopped.current) return;
      recognition.current = null;
      setState("error");
      setMessage(event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone permission was denied. You can complete the request by typing."
        : "Speech recognition failed. You can complete the request by typing.");
    };
    instance.onend = () => {
      recognition.current = null;
      if (!stopped.current) setState((current) => current === "error" ? current : "available");
    };
    try {
      // start() is called only from the microphone button's user gesture.
      setState("requesting_permission");
      setMessage("Allow microphone access in your browser to dictate. You can always type instead.");
      instance.start();
    } catch {
      recognition.current = null;
      setState("error");
      setMessage("Speech recognition could not start. You can complete the request by typing.");
    }
  }

  function readResponse() {
    if (!responseText || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(responseText);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  return { state, message, start, stop, readResponse, stopResponse: () => window.speechSynthesis?.cancel(), canRead: Boolean(responseText) };
}
