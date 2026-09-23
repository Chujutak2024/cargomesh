"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

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
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
    >
      <header className={styles.dialogHeader}>
        <div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
        <button className={styles.dialogClose} type="button" aria-label={closeLabel} onClick={onClose}><X size={18} /></button>
      </header>
      <div className={styles.dialogBody}>{children}</div>
      <footer className={styles.dialogFooter}><Button type="button" onClick={onClose}>{closeLabel}</Button></footer>
    </dialog>
  );
}
