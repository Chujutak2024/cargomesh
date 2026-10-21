"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject, type CSSProperties } from "react";
import { motion, useIsPresent, useMotionValue, useSpring } from "motion/react";
import { useReducedMotionPreference } from "@/features/product-motion/use-motion-preference";
import { ASSISTANT_INTRO_TIMING, assistantEyeOffset } from "./chat-surface-model";
import styles from "./conversation-chat.module.css";

// Shared by the launcher, panel and workspace so they move as one interaction.
export const ASSISTANT_TRANSITION = { duration: .56, ease: [.22, 1, .36, 1] as const };

/** A visual welcome, not a loading gate. A slow/failed catalog never traps the bot at center. */
export function useAssistantEntrance(ready: boolean, skip: boolean, enabled: boolean) {
  const [intro, setIntro] = useState(enabled);
  const started = useRef<number | null>(null);
  useEffect(() => {
    if (!intro) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setIntro(false);
    if (skip || !enabled || media.matches) { finish(); return; }
    started.current ??= performance.now();
    const elapsed = performance.now() - started.current;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const onReady = () => {
      if (ready) readyTimer = setTimeout(finish, Math.max(0, ASSISTANT_INTRO_TIMING.minimumMs - (performance.now() - started.current!)));
    };
    if (document.readyState === "complete") onReady();
    else window.addEventListener("load", onReady, { once: true });
    const fallback = setTimeout(finish, Math.max(0, ASSISTANT_INTRO_TIMING.deadlineMs - elapsed));
    media.addEventListener("change", finish);
    return () => {
      clearTimeout(readyTimer); clearTimeout(fallback);
      window.removeEventListener("load", onReady); media.removeEventListener("change", finish);
    };
  }, [ready, skip, enabled, intro]);
  return intro && enabled && !skip;
}

/** Pointer movement updates motion values, not the conversation/form React state. */
export function AssistantMascot({ active = true, thinking = false, large = false, welcoming = false }: { active?: boolean; thinking?: boolean; large?: boolean; welcoming?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotionPreference();
  const x = useMotionValue(0), y = useMotionValue(0);
  const eyeX = useSpring(x, { stiffness: 180, damping: 22 });
  const eyeY = useSpring(y, { stiffness: 180, damping: 22 });
  useEffect(() => {
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!active || reduced || !pointer.matches) { x.set(0); y.set(0); return; }
    let frame = 0;
    let target = { x: 0, y: 0 };
    const update = () => {
      frame = 0;
      const rect = host.current?.getBoundingClientRect();
      if (!rect) return;
      const offset = assistantEyeOffset(target, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      x.set(offset.x); y.set(offset.y);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      target = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    };
    const reset = () => { cancelAnimationFrame(frame); frame = 0; x.set(0); y.set(0); };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      reset(); window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset); document.removeEventListener("visibilitychange", reset);
    };
  }, [active, reduced, x, y]);
  return <span ref={host} className={styles.mascot} data-large={large} data-thinking={thinking} data-welcoming={welcoming} aria-hidden="true">
    <span className={styles.mascotFace}>
      <motion.span className={styles.mascotEyes} style={{ x: eyeX, y: eyeY }}><i/><i/></motion.span>
    </span>
  </span>;
}

/** Release microphone/session resources immediately, even while the visual panel exits. */
export function AssistantLiveContent({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  return present ? children : null;
}

/** Retain the surface through its exit; exiting controls must not receive focus/clicks. */
export function AssistantSurface({ children, mode, mobile, hostRef, style }: {
  children: ReactNode; mode: "sidebar" | "detached"; mobile: boolean;
  hostRef: RefObject<HTMLDivElement | null>; style?: CSSProperties;
}) {
  const present = useIsPresent(), reduced = useReducedMotionPreference();
  return <motion.div ref={hostRef} className={styles.panelPosition} data-mode={mode} inert={!present}
    style={style} layout="position"
    initial={reduced ? false : { opacity: 0, x: mobile ? 24 : 64, scale: mode === "detached" ? .97 : 1 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    exit={{ opacity: 0, x: reduced ? 0 : 48, transition: { duration: reduced ? 0 : .24 } }}
    transition={reduced ? { duration: 0 } : ASSISTANT_TRANSITION}>
    {children}
  </motion.div>;
}
