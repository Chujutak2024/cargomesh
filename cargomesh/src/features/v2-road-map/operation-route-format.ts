import type { Locale } from "@/features/i18n/config";

export type OperationMapTranslate = (spanish: string, english: string) => string;

/** Operation evidence uses explicit Lima/PET and UTC, independently of the viewer's zone. */
export function formatOperationInstant(value: string | null, locale: Locale, t: OperationMapTranslate): string {
  const instant = value === null ? NaN : Date.parse(value);
  if (!Number.isFinite(instant)) return t("Fecha no disponible", "Time unavailable");
  const parts = (timeZone: string) => {
    const fields = new Intl.DateTimeFormat(locale === "es" ? "es-PE" : "en-GB", {
      timeZone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const field = (type: Intl.DateTimeFormatPartTypes) => fields.find(part => part.type === type)!.value;
    return { date: `${field("day")} ${field("month")} ${field("year")}`, time: `${field("hour")}:${field("minute")}` };
  };
  const local = parts("America/Lima"), utc = parts("UTC");
  return `${local.date}, ${local.time} PET (${local.date === utc.date ? "" : `${utc.date}, `}${utc.time} UTC)`;
}

export function formatOperationDuration(seconds: number | null, locale: Locale, t: OperationMapTranslate): string {
  if (seconds === null || !Number.isFinite(seconds)) return t("No informado", "Not supplied");
  const number = new Intl.NumberFormat(locale === "es" ? "es-PE" : "en-US", { maximumFractionDigits: 2 });
  return `${number.format(seconds / 3600)} h (${number.format(seconds / 60)} min)`;
}
