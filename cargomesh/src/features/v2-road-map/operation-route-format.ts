import { localeTag, type Locale } from "@/features/i18n/config";
import { formatDateTime } from "@/shared/lib/date-time";

export type OperationMapTranslate = (spanish: string, english: string) => string;

/** Use the same explicit PET format as Requests, Bookings and Tracking (F-04). */
export function formatOperationInstant(value: string | null, locale: Locale): string {
  return formatDateTime(value, localeTag(locale));
}

export function formatOperationDuration(seconds: number | null, locale: Locale, t: OperationMapTranslate): string {
  if (seconds === null || !Number.isFinite(seconds)) return t("No informado", "Not supplied");
  const number = new Intl.NumberFormat(locale === "es" ? "es-PE" : "en-US", { maximumFractionDigits: 2 });
  return `${number.format(seconds / 3600)} h (${number.format(seconds / 60)} min)`;
}
