"use client";

import { useEffect, useRef, useState } from "react";

type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

/** Standalone review component. The transcript is never submitted automatically. */
export function PreparatoryVoiceControls({
  locale = "en", onUseTranscript, responseText,
}: {
  locale?: "en" | "es";
  onUseTranscript: (editedText: string) => void;
  responseText: string;
}) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => () => {
    recognition.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  function startFromUserGesture() {
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) {
      setMessage(locale === "es" ? "Este navegador no admite dictado; escribe el mensaje." : "Speech input is unavailable; type your message.");
      return;
    }
    // start() runs only from a click. Browser permission prompts remain browser-owned.
    const instance = new Constructor();
    instance.lang = locale === "es" ? "es-PE" : "en-US";
    instance.interimResults = false;
    instance.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      setTranscript(text);
      setMessage(locale === "es" ? "Revisa y edita la transcripción antes de enviarla." : "Review and edit the transcript before sending it.");
    };
    instance.onerror = () => {
      setListening(false);
      setMessage(locale === "es" ? "No se pudo usar el micrófono. Puedes escribir el mensaje." : "Microphone unavailable. You can type your message.");
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
      setMessage(locale === "es" ? "Escuchando con permiso del navegador…" : "Listening with browser permission…");
    } catch {
      setListening(false);
      setMessage(locale === "es" ? "No se pudo iniciar el dictado; usa texto." : "Speech input could not start; use text.");
    }
  }

  function readResponseFromUserGesture() {
    if (!responseText || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(responseText);
    utterance.lang = locale === "es" ? "es-PE" : "en-US";
    window.speechSynthesis.speak(utterance);
  }

  function stopListening() {
    recognition.current?.stop();
    setListening(false);
    setMessage(locale === "es" ? "Micrófono detenido. Puedes editar el texto o escribir." : "Microphone stopped. You can edit the transcript or type instead.");
  }

  return <div aria-label={locale === "es" ? "Controles opcionales de voz" : "Optional voice controls"}>
    <button type="button" onClick={listening ? stopListening : startFromUserGesture}>
      {listening ? (locale === "es" ? "Detener micrófono" : "Stop microphone")
        : (locale === "es" ? "Dictar con permiso" : "Dictate with permission")}
    </button>
    <label>
      {locale === "es" ? "Transcripción editable" : "Editable transcript"}
      <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} />
    </label>
    <button type="button" disabled={!transcript.trim()} onClick={() => onUseTranscript(transcript.trim())}>
      {locale === "es" ? "Usar texto revisado" : "Use reviewed text"}
    </button>
    <button type="button" disabled={!responseText} onClick={readResponseFromUserGesture}>
      {locale === "es" ? "Leer respuesta" : "Read response"}
    </button>
    <button type="button" onClick={() => window.speechSynthesis?.cancel()}>
      {locale === "es" ? "Detener lectura" : "Stop reading"}
    </button>
    <p role="status">{message}</p>
  </div>;
}
