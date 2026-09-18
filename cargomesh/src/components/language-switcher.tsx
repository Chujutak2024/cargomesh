"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./language-switcher.module.css";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <label className={`${styles.switcher} ${compact ? styles.compact : ""}`}>
      <Languages size={16} aria-hidden="true" />
      <span className={styles.label}>{t("Idioma", "Language")}</span>
      <select
        aria-label={t("Cambiar idioma", "Change language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value === "en" ? "en" : "es")}
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
