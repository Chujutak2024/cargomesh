"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampFloatingPoint, keyboardFloatingPoint, type FloatingPoint } from "./chat-surface-model";

export function useFloatingChat(active = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<FloatingPoint | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const bounds = () => ({ width: ref.current?.offsetWidth ?? 280, height: ref.current?.offsetHeight ?? 56,
    viewportWidth: window.innerWidth, viewportHeight: window.visualViewport?.height ?? window.innerHeight });
  useEffect(() => {
    if (!active) return;
    const clamp = () => setPoint((current) => current ? clampFloatingPoint(current, bounds()) : null);
    const observer = new ResizeObserver(clamp);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener("resize", clamp);
    window.visualViewport?.addEventListener("resize", clamp);
    return () => { observer.disconnect(); window.removeEventListener("resize", clamp); window.visualViewport?.removeEventListener("resize", clamp); };
  }, [active]);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setPoint(clampFloatingPoint({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }, bounds()));
  };
  const endDrag = () => { drag.current = null; };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Home") { event.preventDefault(); setPoint(null); return; }
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const next = keyboardFloatingPoint({ x: rect.left, y: rect.top }, event.key, bounds(), event.shiftKey);
    if (next) { event.preventDefault(); setPoint(next); }
  };
  return { ref, style: point ? { left: point.x, top: point.y, bottom: "auto", right: "auto", transform: "none" } : undefined,
    handle: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag, onKeyDown } };
}
