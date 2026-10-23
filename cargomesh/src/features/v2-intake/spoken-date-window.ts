import { dateClarification, sessionDate, validExplicitWindow, type DateClarification } from "./capture-clarification";
import type { ConversationField } from "./conversation-fields";
type Role = "pickup" | "delivery";
const monthNames = ["january|enero", "february|febrero", "march|marzo", "april|abril", "may|mayo", "june|junio", "july|julio", "august|agosto", "september|septiembre", "october|octubre", "november|noviembre", "december|diciembre"];
const monthPattern = monthNames.join("|");
const rolePattern = /\b(?:pickup|pick[ -]?up|picked up|collection|collect(?:ed)?|recojo|recogida|retiro|salida|sale|salir|depart(?:ure)?|leave|leaves|go out|delivery|deliver(?:ed)?|arriv(?:e|es|al)|entrega|llegada|llega|llegar)\b/gi;
const roleOf = (word: string): Role => /deliver|arriv|entrega|lleg/i.test(word) ? "delivery" : "pickup";
const pad = (n: number | string) => String(n).padStart(2, "0");

function dayFrom(text: string, pending: DateClarification | null, zone: string, now: number): string | null {
  if (/\b(?:or|o)\b/i.test(text) && (text.match(new RegExp(monthPattern, "gi"))?.length || 0) > 1) return null;
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text); if (iso) return iso[1];
  const english = new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i").exec(text);
  const spanish = new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${monthPattern})(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?\\b`, "i").exec(text);
  const match = english || spanish;
  if (match) {
    const month = english ? match[1] : match[2], day = english ? match[2] : match[1];
    const reference = sessionDate(now, zone), year = match[3] || reference.slice(0, 4);
    const date = `${year}-${pad(monthNames.findIndex(names => names.split("|").includes(month.toLowerCase())) + 1)}-${pad(day)}`;
    // Omitted years use the visible session year only for upcoming dates; never silently roll forward.
    return !match[3] && date < reference ? null : date;
  }
  const relative = dateClarification(text, zone, now);
  if (relative) return relative.alternatives.length === 1 && !/\b(?:or|o)\b/i.test(text) ? relative.alternatives[0] : null;
  if (new RegExp(`\\b(?:${monthPattern}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\\b|\\bel\\s+\\d{1,2}\\b`, "i").test(text)) return null;
  return pending?.alternatives.length === 1 ? pending.alternatives[0] : null;
}
function clock(h: string, m?: string, meridiem?: string, common?: string): string | null {
  let hour = Number(h); const minute = Number(m || 0), mer = (meridiem || common || "").replace(/[.\s]/g, "");
  if (mer) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + (mer === "pm" ? 12 : 0); }
  else if (!m && hour < 13) return null;
  return hour <= 23 && minute <= 59 ? `${pad(hour)}:${pad(minute)}` : null;
}
function times(text: string) {
  const words: Record<string, number> = { una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12 };
  const normalized = text.toLowerCase().replace(/\b(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g, word => String(words[word]));
  const common = /de la ma[nñ]ana|morning/i.test(text) ? "am" : /de la tarde|de la noche|afternoon|evening/i.test(text) ? "pm" : undefined;
  const range = /\b(?:de |desde |from |between )?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\s*(?:a|hasta|to|until|and)\s+(?:las\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i.exec(normalized);
  if (range) return { start: clock(range[1],range[2],range[3] || range[6],common), end: clock(range[4],range[5],range[6],common), single: null };
  const single = /^(?:(?:at|from|a las|desde las|las)\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?[.!]?$/i.exec(normalized.trim());
  return { start: null, end: null, single: single ? clock(single[1],single[2],single[3],common) : null };
}

/** Partial clocks stay bound to the user's selected role, not a later mistaken model question. */
export function resolveSpokenDateWindow(text: string, pending: DateClarification | null, zone: string, now: number, roleHint?: Role): { fields: Array<{ field: ConversationField; value: string }>; pendingDate: DateClarification | null; dateResolved: boolean } {
  const fields: Array<{ field: ConversationField; value: string }> = [];
  const roles = [...text.matchAll(rolePattern)];
  const distinct = new Set(roles.map(match => roleOf(match[0])));
  if (distinct.size > 1) {
    const switches = roles.filter((match, i) => i === 0 || roleOf(match[0]) !== roleOf(roles[i-1][0]));
    if (switches.length !== 2 || /\b(?:no|not|maybe|quiz[aá]s|tal vez)\b/i.test(text)) return { fields, pendingDate: pending, dateResolved: false };
    const parts = switches.map((match, i) => text.slice(match.index!, switches[i+1]?.index ?? text.length));
    const results = parts.map((part, i) => resolveSpokenDateWindow(part, null, zone, now, roleOf(switches[i][0])));
    if (results.every(result => result.dateResolved)) return { fields: results.flatMap(result => result.fields), pendingDate: null, dateResolved: true };
    return { fields, pendingDate: pending, dateResolved: false };
  }
  const explicit = roles.length ? roleOf(roles[0][0]) : undefined;
  const samePending = !explicit || !pending?.role || explicit === pending.role ? pending : null;
  const role = explicit || samePending?.role || roleHint;
  // Alternatives require a choice; never silently commit the first named day.
  if (/\b(?:or|o)\b/i.test(text) && new RegExp(`\\b(?:${monthPattern})\\b|\\d{4}-\\d{2}-\\d{2}`, "i").test(text)) return { fields, pendingDate: pending, dateResolved: false };
  const day = dayFrom(text, samePending, zone, now), time = times(text);
  const dateMentioned = new RegExp(`\\b(?:${monthPattern}|today|tomorrow|hoy|ma[nñ]ana)\\b|\\d{4}-\\d{2}-\\d{2}`, "i").test(text);
  if (!role || /\b(?:no|not|maybe|quiz[aá]s|tal vez)\b/i.test(text) || (!dateMentioned && !time.start && !time.single)) return { fields, pendingDate: pending, dateResolved: false };
  // A newly named day may not inherit a different day's clock.
  const sameDay = !day || !samePending?.alternatives.length || samePending.alternatives.includes(day);
  let start = time.start || (sameDay ? samePending?.startTime : undefined), end = time.end || (sameDay ? samePending?.endTime : undefined);
  if (time.single) { if (!start) start = time.single; else end = time.single; }
  if (day && start && end && validExplicitWindow(`${day}T${start}`, `${day}T${end}`)) {
    fields.push({ field: role === "pickup" ? "pickupWindowStartsAt" : "deliveryWindowStartsAt", value: `${day}T${start}` }, { field: role === "pickup" ? "pickupWindowEndsAt" : "deliveryWindowEndsAt", value: `${day}T${end}` });
    return { fields, pendingDate: null, dateResolved: true };
  }
  return { fields, pendingDate: { alternatives: day ? [day] : [], timeZone: zone, referenceDate: sessionDate(now, zone), role, ...(start ? {startTime:start}:{}), ...(end ? {endTime:end}:{}) } as DateClarification, dateResolved: false };
}
