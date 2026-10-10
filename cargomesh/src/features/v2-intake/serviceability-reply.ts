import type { RoadServiceabilityEvaluationV2Data } from "./contracts";

type Summary = Pick<RoadServiceabilityEvaluationV2Data, "summaryCounts" | "overallStatus">;

/** Translate backend evidence into guidance without upgrading eligibility to an offer. */
export function serviceabilityReply(result: Summary, language: "es-PE" | "en-US"): string {
  const { totalEvaluated, eligibleCount, unknownCount } = result.summaryCounts;
  if (language === "en-US") {
    if (eligibleCount > 0) return `The ROAD check found ${eligibleCount} preliminary eligible ${eligibleCount === 1 ? "option" : "options"}. This is not a carrier offer or confirmed capacity; review the details before deciding what to do next.`;
    if (unknownCount > 0 || result.overallStatus === "unknown" || totalEvaluated === 0) return "I cannot confirm ROAD availability for this request yet. Some coverage or capacity data is missing; the result is unknown, not a rejection. You can review the details or prepare a new request with another date or saved facility.";
    return "I could not find an eligible ROAD option for this request at this time. I can help prepare a new request with another date or saved facility. SEA, RAIL and AIR are future capabilities here, not confirmed alternatives.";
  }
  if (eligibleCount > 0) return `La revisión ROAD encontró ${eligibleCount} ${eligibleCount === 1 ? "opción preliminar elegible" : "opciones preliminares elegibles"}. Esto no es una oferta ni capacidad confirmada; revisa los detalles antes de decidir.`;
  if (unknownCount > 0 || result.overallStatus === "unknown" || totalEvaluated === 0) return "Todavía no puedo confirmar disponibilidad ROAD para esta solicitud. Faltan datos de cobertura o capacidad; el resultado es desconocido, no un rechazo. Podemos revisar los detalles o preparar otra solicitud con diferente fecha o sede guardada.";
  return "Por ahora no encontré una opción ROAD elegible para esta solicitud. Puedo ayudarte a preparar otra con diferente fecha o sede guardada. SEA, RAIL y AIR son capacidades futuras aquí, no alternativas confirmadas.";
}
