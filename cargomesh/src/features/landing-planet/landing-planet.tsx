"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { shouldPlayPlanet, type PlaybackIntent } from "./playback-policy";
import styles from "./landing-planet.module.css";

/** A rendered decorative loop. No Three.js or HyperFrames runtime on the product page. */
export function LandingPlanet() {
  const root = useRef<HTMLDivElement>(null), video = useRef<HTMLVideoElement>(null);
  const desired = useRef(false);
  // The landing explicitly requests playback on entry; no initial Play gesture is needed.
  const [intent, setIntent] = useState<PlaybackIntent>("play");
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true), [inViewport, setInViewport] = useState(false);
  const [blocked, setBlocked] = useState(false), [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false), [hasFrame, setHasFrame] = useState(false);
  const [poster, setPoster] = useState("/landing-planet/poster.webp?v=independent-loop-4");
  const play = shouldPlayPlanet({ intent, reducedMotion, visible, inViewport, blocked, failed });
  desired.current = play;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => { setReducedMotion(motion.matches); if (motion.matches) setIntent(current => current === "pause" ? "pause" : "auto"); };
    const updateVisibility = () => setVisible(!document.hidden);
    setReducedMotion(motion.matches); updateVisibility();
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(entries => setInViewport(entries.some(entry => entry.isIntersecting)), { threshold: 0 });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); motion.removeEventListener("change", updateMotion); document.removeEventListener("visibilitychange", updateVisibility); };
  }, []);

  useEffect(() => {
    const media = video.current;
    if (!media) return;
    let active = true;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    if (!play) media.pause();
    else if (!playing) {
      media.muted = true;
      deadline = setTimeout(() => { if (active) { media.pause(); setFailed(true); setHasFrame(false); } }, 12000);
      void media.play().catch(() => { if (active) { setBlocked(true); setPlaying(false); } });
    }
    return () => { active = false; clearTimeout(deadline); };
  }, [play, playing]);

  const toggle = () => {
    if (playing) { desired.current = false; setIntent("pause"); video.current?.pause(); }
    else {
      setIntent("play"); setBlocked(false);
      if (failed) { setFailed(false); video.current?.load(); }
      // Invoke within the gesture as well for browsers requiring user activation.
      if (visible && inViewport) { desired.current = true; void video.current?.play().catch(() => setBlocked(true)); }
    }
  };
  return <div ref={root} className={styles.root} data-planet-playback={failed ? "failed" : blocked ? "blocked" : playing ? "playing" : "paused"} data-reduced-motion={reducedMotion}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className={styles.poster} src={poster} alt="" aria-hidden="true" decoding="async" fetchPriority="high" onError={() => { if (poster !== "/cargomesh-hero-v2.png") setPoster("/cargomesh-hero-v2.png"); }} />
    <video ref={video} className={styles.video} data-visible={hasFrame && !failed && !blocked} poster="/landing-planet/poster.webp?v=independent-loop-4" muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}
      onPlaying={() => { if (!desired.current) { video.current?.pause(); return; } setHasFrame(true); setPlaying(true); setBlocked(false); }}
      onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); setHasFrame(false); }}>
      <source src="/landing-planet/planet-loop.webm?v=independent-loop-4" type="video/webm" />
      <source src="/landing-planet/planet-loop.mp4?v=independent-loop-4" type="video/mp4" onError={() => { setFailed(true); setPlaying(false); setHasFrame(false); }} />
    </video>
    <button className={styles.control} type="button" onClick={toggle} aria-label={playing ? "Pause animation" : failed ? "Retry animation" : "Play animation"} title={playing ? "Pause animation" : "Play animation"}>
      {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}<span>{playing ? "Pause" : failed ? "Retry" : "Play"}</span>
    </button>
    {blocked || failed ? <p className={styles.notice} role="status">{failed ? "Animation unavailable. The illustration is still here." : "Animation paused. Select Play to start."}</p> : null}
  </div>;
}
