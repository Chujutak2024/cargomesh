"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { motion, useAnimationControls } from "motion/react";
import { useReducedMotionPreference } from "./use-motion-preference";

export const PRODUCT_MOTION = { fast: .12, interaction: .16, content: .2, panel: .24, ease: [.2, .8, .2, 1] as const };

/** Stable subtree: never key the wrapper by route, filter or API state. */
export function ContentMotion({ identity, children, className, focusOnChange = false, animateOnMount = false, enabled = true }: {
  identity: string | number; children: ReactNode; className?: string; focusOnChange?: boolean; animateOnMount?: boolean; enabled?: boolean;
}) {
  const reduced = useReducedMotionPreference(), ref = useRef<HTMLDivElement>(null), previous = useRef(identity), mounted = useRef(false), controls = useAnimationControls();
  useEffect(() => {
    const changed = previous.current !== identity;
    controls.stop();
    controls.set({ opacity: 1, y: 0 });
    if (changed && focusOnChange) {
      const title = ref.current?.querySelector<HTMLElement>("h1,h2");
      title?.focus({ preventScroll: true });
      if (title) { const rect = title.getBoundingClientRect(); if (rect.top < 0 || rect.bottom > window.innerHeight) title.scrollIntoView({ block: "nearest", behavior: "instant" }); }
    }
    if (enabled && !reduced && (changed || (!mounted.current && animateOnMount))) {
      controls.set({ opacity: 1, y: 6 });
      void controls.start({ opacity: 1, y: 0, transition: { duration: PRODUCT_MOTION.content, ease: PRODUCT_MOTION.ease } });
    }
    if (!reduced) mounted.current = true;
    previous.current = identity;
    return () => controls.stop();
  }, [identity, focusOnChange, animateOnMount, enabled, reduced, controls]);
  return <motion.div ref={ref} className={className} data-motion-region={identity} data-reduced-motion={reduced ? "true" : "false"} initial={false} animate={controls}>{children}</motion.div>;
}
