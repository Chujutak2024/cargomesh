"use client";

import { useEffect, useRef, useState } from "react";
import { shouldPlayPlanet } from "./playback-policy";
import styles from "./landing-planet.module.css";

/** A rendered decorative loop. No Three.js or HyperFrames runtime on the product page. */
export function LandingPlanet() {
  const root = useRef<HTMLDivElement>(null), video = useRef<HTMLVideoElement>(null);
  const desired = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true), [inViewport, setInViewport] = useState(false);
  const [blocked, setBlocked] = useState(false), [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false), [hasFrame, setHasFrame] = useState(false);
  const [poster, setPoster] = useState("/landing-planet/poster.webp?v=independent-loop-4");
  const play = shouldPlayPlanet({ intent: "auto", reducedMotion, visible, inViewport, blocked, failed });
  desired.current = play;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
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

  return <div ref={root} className={styles.root} data-planet-playback={failed ? "failed" : blocked ? "blocked" : playing ? "playing" : "paused"} data-reduced-motion={reducedMotion}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className={styles.poster} src={poster} alt="" aria-hidden="true" decoding="async" fetchPriority="high" onError={() => { if (poster !== "/cargomesh-hero-v2.png") setPoster("/cargomesh-hero-v2.png"); }} />
    <video ref={video} className={styles.video} data-visible={hasFrame && !failed && !blocked} poster="/landing-planet/poster.webp?v=independent-loop-4" muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}
      onPlaying={() => { if (!desired.current) { video.current?.pause(); return; } setHasFrame(true); setPlaying(true); setBlocked(false); }}
      onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); setHasFrame(false); }}>
      <source src="/landing-planet/planet-loop.webm?v=independent-loop-4" type="video/webm" />
      <source src="/landing-planet/planet-loop.mp4?v=independent-loop-4" type="video/mp4" onError={() => { setFailed(true); setPlaying(false); setHasFrame(false); }} />
    </video>
  </div>;
}
