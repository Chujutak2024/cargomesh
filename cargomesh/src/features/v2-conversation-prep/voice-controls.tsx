"use client";

import { useEffect, useRef, useState } from "react";
import { recognitionEndMessage, recognitionErrorMessage } from "./voice-status";
import { resolveBrowserSpeechSupport } from "./browser-speech-support";
import { createSpeechTurnDetector } from "./speech-turn";

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
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const playbackId = useRef(0);
  const mode = useRef<"remote" | "local" | "unsupported">("unsupported");

  onSilenceRef.current = onSilence;
  onTranscriptRef.current = onTranscript;

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
      window.speechSynthesis?.cancel();
      speechRequest.current?.abort();
      audio.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
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

  function readBrowserResponse(text: string) {
    if (!window.speechSynthesis) { setSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang === language && /natural|neural|enhanced|premium/i.test(voice.name))
      ?? voices.find((voice) => voice.lang === language)
      ?? voices.find((voice) => voice.lang.startsWith(language.slice(0, 2))) ?? null;
    utterance.rate = 0.96;
    utterance.onstart = () => { setSpeaking(true); setMessage("CargoMesh is speaking. Press Stop audio before starting another voice turn."); };
    utterance.onend = () => { setSpeaking(false); setState("available"); setMessage(""); };
    utterance.onerror = () => { setSpeaking(false); setState("available"); setMessage("Audio playback stopped. You can continue by voice or text."); };
    window.speechSynthesis.speak(utterance);
  }

  function clearAudio() {
    speechRequest.current?.abort();
    speechRequest.current = null;
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    window.speechSynthesis?.cancel();
  }

  function readResponse(text = responseText) {
    if (!text) return;
    clearAudio();
    const id = ++playbackId.current;
    const controller = new AbortController();
    speechRequest.current = controller;
    setSpeaking(true);
    void (async () => {
      try {
        const response = await fetch("/api/v2/conversation/speech", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }), signal: controller.signal,
        });
        if (!response.ok) throw new Error("Speech service unavailable");
        const blob = await response.blob();
        if (id !== playbackId.current) return;
        const url = URL.createObjectURL(blob);
        audioUrl.current = url;
        const player = new Audio(url);
        audio.current = player;
        player.onended = () => { if (id === playbackId.current) { clearAudio(); setSpeaking(false); setState("available"); setMessage(""); } };
        player.onerror = () => { if (id === playbackId.current) { clearAudio(); readBrowserResponse(text); } };
        await player.play();
        setMessage("CargoMesh is speaking. Press Stop audio to interrupt.");
      } catch {
        if (id !== playbackId.current || controller.signal.aborted) return;
        clearAudio();
        readBrowserResponse(text);
      }
    })();
  }

  function stopResponse() {
    playbackId.current += 1;
    clearAudio();
    setSpeaking(false);
    setState("available");
    setMessage("Audio stopped. You can speak again or type.");
  }

  function finishProcessing() {
    setState("available");
    setMessage("");
  }

  return { state, message, speaking, start, stop, readResponse, stopResponse, finishProcessing, canRead: Boolean(responseText) };
}
