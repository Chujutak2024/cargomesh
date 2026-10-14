"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, type InputHTMLAttributes } from "react";
import styles from "./v2-ui.module.css";

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "size"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  clearLabel?: string;
  hideLabel?: boolean;
  shortcut?: boolean;
  fieldClassName?: string;
};

/** Local filtering stays immediate; remote search owns its request/debounce policy. */
export function SearchField({ label, value, onValueChange, clearLabel = "Clear search", hideLabel = false, shortcut = false, fieldClassName, className, id, disabled, ...props }: SearchFieldProps) {
  const generatedId = useId(), inputId = id ?? generatedId;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shortcut || disabled) return;
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]') || document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')) return;
      if (!input.current?.getClientRects().length || input.current.closest("[inert]")) return;
      event.preventDefault();
      input.current.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [shortcut, disabled]);
  return <div className={[styles.field, styles.searchField, fieldClassName].filter(Boolean).join(" ")} data-cm-search>
    <label className={hideLabel ? styles.visuallyHidden : styles.fieldLabel} htmlFor={inputId}>{label}</label>
    <div className={styles.searchControl}>
      <Search size={17} aria-hidden="true" />
      <input {...props} ref={input} id={inputId} type="search" value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)} className={className} aria-keyshortcuts={shortcut ? "/" : undefined} />
      {value ? <button type="button" disabled={disabled} aria-label={clearLabel} onClick={() => { onValueChange(""); input.current?.focus(); }}><X size={16} aria-hidden="true" /></button> : shortcut ? <kbd aria-hidden="true">/</kbd> : null}
    </div>
  </div>;
}
