"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "./button";
import styles from "./v2-ui.module.css";

export type DialogProps = {
  open: boolean;
  title: string;
  description: string;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
};

export function Dialog({ open, title, description, closeLabel, children, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}>
      <header className={styles.dialogHeader}>
        <div><h2>{title}</h2><p>{description}</p></div>
        <button className={styles.dialogClose} type="button" aria-label={closeLabel} onClick={onClose}><X size={18} /></button>
      </header>
      <div className={styles.dialogBody}>{children}</div>
      <footer className={styles.dialogFooter}><Button type="button" onClick={onClose}>{closeLabel}</Button></footer>
    </dialog>
  );
}
