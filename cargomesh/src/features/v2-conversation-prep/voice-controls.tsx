"use client";

import { useEffect, useRef, useState } from "react";
import { recognitionEndMessage, recognitionErrorMessage } from "./voice-status";
import { resolveBrowserSpeechSupport } from "./browser-speech-support";
import { createSpeechTurnDetector } from "./speech-turn";
import { chosenSpeechVoice, voicesForLanguage } from "./speech-voices";

type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }> & { isFinal?: boolean }> };
type RecognitionError = { error?: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};
type RecognitionConstructor = (new () => Recognition) & {
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
};
type BraveNavigator = Navigator & { brave?: { isBrave?: () => Promise<boolean> } };

export type VoiceState = "checking" | "available" | "requesting_permission" | "listening" | "processing" | "error" | "unsupported";

/** Browser-only capture and playback. The parent decides how to handle a completed turn. */
export function useConversationVoice({ onTranscript, onSilence, responseText, language }: {
  onTranscript: (text: string) => void;
  onSilence: (text: string) => void;
  responseText: string;
  /** Web Speech has no dependable automatic language detection. The user picks the recognition locale. */
  language: "es-PE" | "en-US";
}) {
  const [state, setState] = useState<VoiceState>("checking");
  const [message, setMessage] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const stopped = useRef(false);
  const hasTranscript = useRef(false);
  const turnDetector = useRef<ReturnType<typeof createSpeechTurnDetector> | null>(null);
  const onSilenceRef = useRef(onSilence);
  const onTranscriptRef = useRef(onTranscript);
  const [speaking, setSpeaking] = useState(false);
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const mode = useRef<"remote" | "local" | "unsupported">("unsupported");

  onSilenceRef.current = onSilence;
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const refresh = () => setAvailableVoices(synth.getVoices());
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, []);

  function finishTurn(instance: Recognition, transcript: string) {
    if (stopped.current || recognition.current !== instance) return;
    stopped.current = true;
    recognition.current = null;
    try { instance.stop(); } catch { /* The browser may have already ended recognition. */ }
    setState("processing");
    setMessage("Speech ended. Preparing your response…");
    onSilenceRef.current(transcript);
  }

  useEffect(() => {
    const browser = window as SpeechWindow;
    let active = true;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    void (async () => {
      let isBrave = false;
      try { isBrave = Boolean(await (navigator as BraveNavigator).brave?.isBrave?.()); } catch { /* Detection is advisory. */ }
      let localAvailability: string | null = null;
      if (isBrave && Constructor?.available) {
        try { localAvailability = await Promise.race([
          Constructor.available({ langs: [language], processLocally: true }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]); } catch { /* Do not present a broken engine as available. */ }
      }
      if (!active) return;
      const support = resolveBrowserSpeechSupport({ hasRecognition: Boolean(Constructor), isBrave, localAvailability });
      mode.current = support.mode;
      setState(support.mode === "unsupported" ? "unsupported" : "available");
      setMessage(support.message);
    })();
    return () => {
      active = false;
      turnDetector.current?.cancel();
      recognition.current?.stop();
      activeUtterance.current = null;
      window.speechSynthesis?.cancel();
    };
  }, [language]);

  function stop() {
    stopped.current = true;
    turnDetector.current?.cancel();
    recognition.current?.stop();
    recognition.current = null;
    setState("available");
    setMessage(hasTranscript.current ? recognitionEndMessage(true) : "Listening stopped. You can try again or type your message.");
  }

  function start() {
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor || mode.current === "unsupported" || speaking) {
      setState("unsupported");
      setMessage("Speech recognition is unavailable here. Type your message, or use a browser with a working speech engine for the selected language.");
      return;
    }
    stopped.current = false;
    hasTranscript.current = false;
    const instance = new Constructor();
    recognition.current = instance;
    const detector = createSpeechTurnDetector((transcript) => finishTurn(instance, transcript));
    turnDetector.current = detector;
    instance.lang = language;
    if (mode.current === "local") instance.processLocally = true;
    instance.interimResults = true;
    instance.continuous = true;
    instance.onstart = () => {
      if (stopped.current) return;
      setState("listening");
      setMessage("Listening… Press Stop listening when finished.");
    };
    instance.onresult = (event) => {
      if (stopped.current || recognition.current !== instance) return;
      const results = Array.from(event.results);
      const recognized = results.map((result) => result[0]?.transcript ?? "").join(" ").trim();
      const final = results.filter((result) => result.isFinal).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (recognized) {
        hasTranscript.current = true;
        onTranscriptRef.current(recognized);
        if (final) {
          detector.update(final);
        }
      }
      setState("listening");
      setMessage(final ? "Listening… Pause after speaking to send, or press Stop to edit first." : "Listening… Waiting for a confirmed transcript. Press Stop to edit first.");
    };
    instance.onerror = (event) => {
      if (stopped.current || recognition.current !== instance) return;
      detector.cancel();
      recognition.current = null;
      setState("error");
      setMessage(recognitionErrorMessage(event.error));
    };
    instance.onend = () => {
      if (recognition.current !== instance) return;
      if (!stopped.current) {
        if (detector.hasTranscript()) detector.finish();
        else {
          recognition.current = null;
          setState("available");
          setMessage(hasTranscript.current ? "Recognition ended before confirming the words. Review the transcript and send it manually, or try again." : recognitionEndMessage(false));
        }
      }
    };
    try {
      // start() is called only from the microphone button's user gesture.
      setState("requesting_permission");
      setMessage("Allow microphone access in your browser to dictate. You can always type instead.");
      instance.start();
    } catch {
      recognition.current = null;
      detector.cancel();
      setState("error");
      setMessage("Speech recognition could not start. You can complete the request by typing.");
    }
  }

  function readResponse(text = responseText) {
    if (!text || !window.speechSynthesis) return;
    activeUtterance.current = null;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    activeUtterance.current = utterance;
    utterance.lang = language;
    utterance.voice = chosenSpeechVoice(window.speechSynthesis.getVoices(), language, selectedVoiceURI);
    utterance.rate = 0.96;
    utterance.onstart = () => { if (activeUtterance.current === utterance) { setSpeaking(true); setMessage("CargoMesh is speaking. Press Stop audio before starting another voice turn."); } };
    utterance.onend = () => { if (activeUtterance.current === utterance) { activeUtterance.current = null; setSpeaking(false); setState("available"); setMessage(""); } };
    utterance.onerror = () => { if (activeUtterance.current === utterance) { activeUtterance.current = null; setSpeaking(false); setState("available"); setMessage("Audio playback stopped. You can continue by voice or text."); } };
    window.speechSynthesis.speak(utterance);
  }

  function stopResponse() {
    activeUtterance.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setState("available");
    setMessage("Audio stopped. You can speak again or type.");
  }

  function finishProcessing() {
    setState("available");
    setMessage("");
  }

  return { state, message, speaking, start, stop, readResponse, stopResponse, finishProcessing, canRead: Boolean(responseText),
    availableVoices: voicesForLanguage(availableVoices, language), selectedVoiceURI, setSelectedVoiceURI };
}
