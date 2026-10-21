"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { VoiceDraftContext } from "./voice-draft-context";
import type { ConversationLanguage } from "./conversation-language";
import { shouldRenewVoiceSession } from "./voice-session-renewal";
import styles from "./nova-voice-preview.module.css";

type Grant = { wsUrl: string; token: string };
type VoiceEvent =
  | { type: "ready" | "barge_in" | "response_start" | "response_end" | "response_incomplete" }
  | { type: "audio"; audio: string; format: string; sampleRate: number; channels: number }
  | { type: "transcript"; role: "user" | "assistant"; contentId: string; text: string }
  | { type: "transcript_delta"; role: "user" | "assistant"; contentId: string; delta: string }
  | { type: "session_limit" }
  | { type: "error"; message: string };

export function NovaVoicePreview({ preview = false, carrierScope, offerRequestId, autoStart = false, voiceContext = [], language, draftContext, onResponseFinished, onPlaybackStateChange, onTurn }: {
  preview?: boolean;
  carrierScope?: { carrierId: string; opportunityId: string };
  offerRequestId?: string;
  autoStart?: boolean;
  voiceContext?: string[];
  language?: ConversationLanguage;
  draftContext?: VoiceDraftContext;
  onResponseFinished?: () => void;
  onPlaybackStateChange?: (speaking: boolean) => void;
  onTurn: (update: { role: "user" | "assistant"; contentId: string; text: string; final: boolean }) => void;
}) {
  const { locale } = useLocale();
  const sessionContextRef = useRef({ language: language ?? (locale === "es" ? "es" : "en"), draftContext });
  sessionContextRef.current = { language: language ?? (locale === "es" ? "es" : "en"), draftContext };
  const es=(language??locale)==="es";
  const [status, setStatus] = useState(es?"Voz Nova lista.":"Nova voice ready.");
  // Draft/language updates are normal voice turns, not a reason to close the transport.
  const scopeFingerprint=JSON.stringify([preview, carrierScope?.carrierId ?? null, carrierScope?.opportunityId ?? null, offerRequestId ?? null]);
  const scopeRef=useRef(scopeFingerprint);
  scopeRef.current=scopeFingerprint;
  const grantedScopeRef=useRef<string|null>(null);
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const captureVersionRef = useRef(0);
  const microphoneRef = useRef<Promise<MediaStream> | null>(null);
  const workletLoadedRef = useRef(false);
  const readyRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const outputsRef = useRef<AudioBufferSourceNode[]>([]);
  const [finishing,setFinishing]=useState(false);
  const responseActiveRef=useRef(false);
  const responseFinishedOnceRef=useRef(true);
  const speakingRef=useRef(false);
  const responseFinishedRef=useRef(onResponseFinished);responseFinishedRef.current=onResponseFinished;
  const playbackCallbackRef=useRef(onPlaybackStateChange);
  playbackCallbackRef.current=onPlaybackStateChange;
  const drainRef=useRef<(()=>void)|null>(null);
  const finishTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  function reportSpeaking(value:boolean){
    if(speakingRef.current===value)return;
    speakingRef.current=value;playbackCallbackRef.current?.(value);
  }
  function finishPlayback(){
    if(finishTimerRef.current!==null)clearTimeout(finishTimerRef.current);
    if(outputsRef.current.length||responseActiveRef.current)return;
    // Older gateways have no response boundaries: allow a short inter-chunk gap.
    finishTimerRef.current=setTimeout(()=>{
      finishTimerRef.current=null;
      if(outputsRef.current.length||responseActiveRef.current)return;
      reportSpeaking(false);
      if(!responseFinishedOnceRef.current||drainRef.current){responseFinishedOnceRef.current=true;responseFinishedRef.current?.();}
      const drained=drainRef.current;drainRef.current=null;drained?.();
    },180);
  }
  function finishSession(renew:boolean,message:string){
    if(drainRef.current)return;
    readyRef.current=false;pauseCapture();responseActiveRef.current=false;setFinishing(true);
    setStatus(outputsRef.current.length?(es?"Terminando la respuesta de Nova…":"Finishing Nova's response…"):message);
    drainRef.current=()=>{stop();setFinishing(false);if(renew)void start(true);else setStatus(message);};
    finishPlayback();
  }
  const nextPlayRef = useRef(0);
  const stoppedRef = useRef(true);
  const voiceContextRef = useRef(voiceContext);
  const sessionStartedAtRef = useRef(0);
  const lastUserTurnAtRef = useRef(0);
  const renewOnCloseRef = useRef(false);
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;
  voiceContextRef.current = voiceContext;

  function stop() {
    if(finishTimerRef.current!==null)clearTimeout(finishTimerRef.current);
    finishTimerRef.current=null;drainRef.current=null;responseActiveRef.current=false;reportSpeaking(false);setFinishing(false);
    stoppedRef.current = true;
    readyRef.current = false;
    pauseCapture();
    renewOnCloseRef.current = false;
    sessionStartedAtRef.current = 0;
    lastUserTurnAtRef.current = 0;
    outputsRef.current.forEach((output) => { try { output.stop(); } catch { /* Already ended. */ } });
    outputsRef.current = [];
    socketRef.current?.close();
    socketRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    workletLoadedRef.current = false;
    nextPlayRef.current = 0;
    setActive(false);
  }

  useEffect(() => () => {
    if(finishTimerRef.current!==null)clearTimeout(finishTimerRef.current);
    drainRef.current=null;responseActiveRef.current=false;
    stoppedRef.current = true;
    listeningRef.current = false;
    captureVersionRef.current++;
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void microphoneRef.current?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
    outputsRef.current.forEach((output) => { try { output.stop(); } catch { /* Already ended. */ } });
    socketRef.current?.close();
    void contextRef.current?.close();
  }, []);

  useEffect(()=>{
    if(active&&grantedScopeRef.current!==null&&grantedScopeRef.current!==scopeFingerprint){
      stop();
      setStatus(es?"Cambió la solicitud o el espacio autorizado. Continúa para abrir una sesión con ese acceso.":"The authorized request or workspace changed. Continue to connect with that scope.");
    }
  },[scopeFingerprint,active,es]);

  function prepareMicrophone() {
    if (!microphoneRef.current) {
      const pending = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      microphoneRef.current = pending;
      void pending.then((stream) => {
        if (microphoneRef.current !== pending || stoppedRef.current || !listeningRef.current) stream.getTracks().forEach((track) => track.stop());
      }).catch(() => {});
    }
    return microphoneRef.current;
  }

  function pauseCapture() {
    listeningRef.current = false;
    setListening(false);
    captureVersionRef.current++;
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    workletRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void microphoneRef.current?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
    microphoneRef.current = null;
    renewOnCloseRef.current = false;
    setStatus((es?"Micrófono apagado. Conservamos tu conversación y borrador. Continúa cuando quieras hablar.":"Microphone off. Your conversation and draft are intact. Resume when you want to speak."));
  }

  function playAudio(event: Extract<VoiceEvent, { type: "audio" }>) {
    const context = contextRef.current;
    if (!context || event.format !== "pcm" || event.channels !== 1
      || !Number.isInteger(event.sampleRate) || event.sampleRate < 8000 || event.sampleRate > 48000
      || typeof event.audio !== "string" || event.audio.length > 256_000) return;
    let binary: string;
    try { binary = atob(event.audio); } catch { return; }
    if (!binary.length || binary.length % 2) return;
    const view = new DataView(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) view.setUint8(i, binary.charCodeAt(i));
    const samples = context.createBuffer(1, binary.length / 2, event.sampleRate);
    const channel = samples.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    if(finishTimerRef.current!==null)clearTimeout(finishTimerRef.current);
    responseFinishedOnceRef.current=false;reportSpeaking(true);
    const output = context.createBufferSource();
    output.buffer = samples;
    output.connect(context.destination);
    outputsRef.current.push(output);
    output.onended = () => { outputsRef.current = outputsRef.current.filter((item) => item !== output); finishPlayback(); };
    const start = Math.max(context.currentTime + 0.025, nextPlayRef.current);
    output.start(start);
    nextPlayRef.current = start + samples.duration;
  }

  async function startCapture(socket: WebSocket) {
    const version = ++captureVersionRef.current;
    listeningRef.current = true;
    setListening(true);
    setStatus((es?"Preparando micrófono…":"Preparing microphone…"));
    const stream = await prepareMicrophone();
    if (stoppedRef.current || !listeningRef.current || version !== captureVersionRef.current) {
      stream.getTracks().forEach((track) => track.stop()); return;
    }
    const context = contextRef.current ?? new AudioContext();
    streamRef.current = stream;
    contextRef.current = context;
    if (!workletLoadedRef.current) {
      await context.audioWorklet.addModule("/nova-pcm-worklet.js");
      workletLoadedRef.current = true;
    }
    if (stoppedRef.current || !listeningRef.current || version !== captureVersionRef.current) return;
    await context.resume();
    const source = context.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(context, "nova-pcm-worklet");
    sourceRef.current = source;
    workletRef.current = worklet;
    worklet.port.onmessage = (message: MessageEvent<ArrayBuffer>) => {
      if (socket.readyState === WebSocket.OPEN && !stoppedRef.current && listeningRef.current) socket.send(speakingRef.current ? new ArrayBuffer(message.data.byteLength) : message.data);
    };
    source.connect(worklet);
    // Some browsers do not run a worklet unless it is attached to an output.
    const muted = context.createGain();
    muted.gain.value = 0;
    worklet.connect(muted).connect(context.destination);
    setStatus((es?"Escuchando con Nova. Revisa y confirma en pantalla cualquier acción comercial.":"Listening with Nova. Review and confirm any business action on screen."));
  }

  async function start(renewing = false) {
    if (!stoppedRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
      setStatus((es?"Este navegador no permite iniciar voz Nova. Continúa por texto.":"This browser cannot start Nova voice. Use the existing microphone or text."));
      return;
    }
    stoppedRef.current = false;
    grantedScopeRef.current = null;
    readyRef.current = false;
    listeningRef.current = true;
    setListening(true);
    setActive(true);
    setStatus(renewing ? (es?"Continuando tu conversación con Nova…":"Continuing your Nova conversation…") : (es?"Conectando con Nova. La primera conexión puede tardar unos segundos…":"Connecting to Nova. The first connection can take a few seconds…"));
    const sessionId = crypto.randomUUID();
    try {
      prepareMicrophone();
      // Let the final transcript update the parent history before requesting a fresh grant.
      if (renewing) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        if (stoppedRef.current) return;
      }
      const contextForGrant=sessionContextRef.current;
      const scopeForGrant=scopeRef.current;
      const response = await fetch("/api/v2/conversation/voice/session", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview, ...carrierScope, offerRequestId, voiceContext: voiceContextRef.current, ...contextForGrant }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? (es?"Inicia sesión para usar voz Nova.":"Sign in to try Nova voice.") : (es?"Voz Nova no está configurada aquí. Continúa por texto.":"Nova voice is not configured here. Use the existing voice or text."));
      const grant = await response.json() as Grant;
      grantedScopeRef.current=scopeForGrant;
      if(scopeRef.current!==scopeForGrant){stop();setStatus(es?"Cambió el acceso durante la conexión. Continúa de nuevo.":"Authorization scope changed while connecting. Continue again.");return;}
      if (stoppedRef.current) return;
      const socket = new WebSocket(grant.wsUrl);
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token: grant.token }));
      socket.onmessage = (message) => {
        if (socketRef.current !== socket || stoppedRef.current) return;
        let event: VoiceEvent;
        try { event = JSON.parse(String(message.data)) as VoiceEvent; } catch { return; }
        if (event.type === "ready") {
          readyRef.current = true;
          sessionStartedAtRef.current = Date.now();
          if (listeningRef.current) void startCapture(socket).catch(() => { stop(); setStatus((es?"Micrófono no disponible. Continúa por texto.":"Microphone unavailable. Continue by text.")); });
          else setStatus((es?"Micrófono apagado. Continúa cuando quieras hablar.":"Microphone off. Resume when you want to speak."));
        } else if(event.type==="response_start") {
          responseActiveRef.current=true;responseFinishedOnceRef.current=false;reportSpeaking(true);
        } else if(event.type==="response_end") {
          responseActiveRef.current=false;finishPlayback();
        } else if(event.type==="response_incomplete") {
          setStatus(es?"La conexión terminó antes de completar la respuesta. Conservamos tu borrador.":"The connection ended before the response completed. Your draft is preserved.");
        } else if (event.type === "audio") playAudio(event);
        else if ((event.type === "transcript" || event.type === "transcript_delta")
          && (event.role === "user" || event.role === "assistant") && typeof event.contentId === "string") {
          const text = event.type === "transcript" ? event.text : event.delta;
          const final = event.type === "transcript";
          if (typeof text === "string" && text && text.length <= 4096) {
            if (final && event.role === "user") lastUserTurnAtRef.current = Date.now();
            if (final && event.role === "user") setStatus((es?"Nova te escuchó y está preparando una respuesta…":"Nova heard you and is preparing a reply…"));
            if (final && event.role === "assistant") setStatus(listeningRef.current
              ? (es?"Escuchando con Nova. Revisa y confirma en pantalla cualquier acción comercial.":"Listening with Nova. Review and confirm any business action on screen.")
              : (es?"Micrófono apagado. Conservamos tu conversación y borrador. Continúa cuando quieras hablar.":"Microphone off. Your conversation and draft are intact. Resume when you want to speak."));
            onTurnRef.current({ role: event.role, contentId: `nova:${sessionId}:${event.contentId}`, text, final });
            if(final&&event.role==="assistant"&&!responseActiveRef.current)finishPlayback();
          }
        } else if (event.type === "session_limit") {
          renewOnCloseRef.current = listeningRef.current && shouldRenewVoiceSession(sessionStartedAtRef.current, lastUserTurnAtRef.current, Date.now());
        } else if (event.type === "barge_in") {
          // Never discard already received speech on an unsolicited interruption event.
          responseActiveRef.current=false;finishPlayback();
        } else if (event.type === "error") {
          finishSession(false,event.message);
        }
      };
      socket.onerror = () => { if (socketRef.current === socket) setStatus((es?"Falló la conexión de voz. Continúa por texto.":"Voice connection failed. Continue by text.")); };
      socket.onclose = () => {
        if (!stoppedRef.current && socketRef.current === socket) {
          const renew = renewOnCloseRef.current;
          finishSession(renew,es?"Nova está en pausa. Conservamos tu borrador; pulsa Continuar con Nova.":"Nova paused. Your draft is intact; choose Talk with Nova to continue.");
        }
      };
    } catch (error) {
      stop();
      setStatus(error instanceof Error ? error.message : (es?"Voz Nova no disponible.":"Nova voice is unavailable."));
    }
  }

  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(() => { void start(); }, 0);
    return () => window.clearTimeout(timer);
  }, [autoStart]);

  return <div className={styles.preview}>
    <button type="button" disabled={finishing} className={active && listening ? styles.active : styles.start} aria-label={active ? (listening ? "Turn off Nova microphone" : "Resume Nova microphone") : "Start Nova voice"}
      onClick={active ? listening ? () => pauseCapture() : () => {
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN && readyRef.current) void startCapture(socket).catch(() => { stop(); setStatus((es?"Micrófono no disponible. Continúa por texto.":"Microphone unavailable. Continue by text.")); });
        else { listeningRef.current = true; setListening(true); setStatus((es?"Conectando con Nova…":"Connecting to Nova…")); }
      } : () => void start()}>
      {active ? (listening ? (es?"Apagar micrófono":"Stop listening") : (es?"Continuar escuchando":"Resume listening")) : (es?"Continuar con Nova":"Talk with Nova")}
    </button>
    <p role="status">{status}</p>
    <p className={styles.limit}>{es?"Completa y corrige los datos por voz. Di «revisa el resumen» cuando quieras confirmar. Nova termina de hablar antes de volver a escucharte.":"Nova guides by voice. Recognized details enter a local draft; review every field and explicitly confirm before a request is created."}</p>
  </div>;
}
