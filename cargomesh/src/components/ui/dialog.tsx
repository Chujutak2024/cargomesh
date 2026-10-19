"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useAnimationControls } from "motion/react";
import { PRODUCT_MOTION } from "@/features/product-motion/content-motion";
import { useReducedMotionPreference } from "@/features/product-motion/use-motion-preference";
import { Button } from "./button";
import { lockDocumentScroll } from "@/shared/browser/scroll-lock";
import styles from "./v2-ui.module.css";

export type DialogProps = {
  open: boolean; title: string; description: string; closeLabel: string;
  children: ReactNode; onClose: () => void; footer?: ReactNode; animated?: boolean; closeDisabled?: boolean; className?: string;
};

export function Dialog({ open, title, description, closeLabel, children, onClose, footer, animated = false, closeDisabled = false, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLElement | null>(null);
  const titleId = useId(), descriptionId = useId(), reduced = useReducedMotionPreference(), controls = useAnimationControls();
  const closing = useRef(false), alive = useRef(false), closeCallback = useRef(onClose);
  const [exiting, setExiting] = useState(false);
  closeCallback.current = onClose;
  useEffect(() => {
    alive.current = true;
    const dialog = ref.current;
    if (!dialog) return;
    const releaseScroll = open ? lockDocumentScroll(document) : () => {};
    if (open && !dialog.open) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closing.current = false;
      setExiting(false);
      dialog.showModal();
    }
    if (!open && dialog.open) { dialog.close(); trigger.current?.focus({ preventScroll: true }); }
    return () => { releaseScroll(); alive.current = false; controls.stop(); const wasOpen = dialog.open; if (wasOpen) dialog.close(); if (wasOpen && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); };
  }, [open, controls]);
  useEffect(() => {
    if (!open) return;
    controls.stop();
    if (closing.current) { closeCallback.current(); return; }
    controls.set({ opacity: 1, y: animated && !reduced ? 8 : 0 });
    if (animated && !reduced) void controls.start({ opacity: 1, y: 0, transition: { duration: PRODUCT_MOTION.panel, ease: PRODUCT_MOTION.ease } });
  }, [open, animated, reduced, controls]);
  const requestClose = async () => {
    if (closeDisabled || closing.current) return;
    closing.current = true;
    setExiting(true);
    if (animated && !reduced) await controls.start({ opacity: 0, y: 8, transition: { duration: PRODUCT_MOTION.fast, ease: PRODUCT_MOTION.ease } });
    if (alive.current) closeCallback.current();
  };
  return <motion.dialog ref={ref} className={[styles.dialog, className].filter(Boolean).join(" ")} data-animated={animated} aria-labelledby={titleId} aria-describedby={descriptionId} initial={false} animate={controls}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length && !element.closest('[inert]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); void requestClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) void requestClose(); } }}>
    <header className={styles.dialogHeader}><div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button className={styles.dialogClose} type="button" aria-label={closeLabel} disabled={closeDisabled} onClick={() => void requestClose()}><X size={18} aria-hidden="true" /></button></header>
    <div className={styles.dialogBody} inert={exiting}>{children}</div>
    <footer className={styles.dialogFooter} inert={exiting}>{footer ?? <Button type="button" disabled={closeDisabled} onClick={() => void requestClose()}>{closeLabel}</Button>}</footer>
  </motion.dialog>;
}
