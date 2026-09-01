export const landingCopy = {
  es: {
    brand: { name: "CargoMesh", label: "Control tower" },
    nav: {
      ariaLabel: "Navegación principal",
      homeLabel: "CargoMesh, inicio",
      howItWorks: "Cómo funciona",
      signIn: "Acceder",
    },
    hero: {
      eyebrow: "Freight orchestration · WebMCP",
      title: "Decisiones de carga claras, desde la solicitud hasta el destino.",
      description:
        "CargoMesh conecta tu intención de transporte con las capacidades reales de cada carrier para que tu equipo pueda decidir, reservar y recuperarse con evidencia.",
      primaryCta: "Probar la demo",
      secondaryCta: "Cómo funciona",
      signalsLabel: "Principios de CargoMesh",
      signals: ["Registro abierto", "Respuestas estructuradas", "Decisiones auditables"],
      visualLabel: "Vista resumida del flujo de orquestación",
      visual: {
        eyebrow: "Flujo de orquestación",
        status: "Listo para decidir",
        originLabel: "Origen",
        origin: "Callao / Lima",
        destinationLabel: "Destino",
        destination: "Santiago",
        discovery: "Carriers registrados",
        discoveryValue: "0..N",
        evidence: "Evidencia WebMCP",
        evidenceValue: "Verificada",
        ranking: "Ranking BALANCED",
        rankingValue: "Reproducible",
        confidenceLabel: "Confianza de decisión",
        confidence: "88 / 100",
        traceabilityTitle: "Trazabilidad completa",
        traceabilityDescription: "Cada paso conserva su evidencia",
      },
    },
    flow: {
      eyebrow: "Cómo funciona",
      title: "Una decisión trazable de principio a fin.",
      description:
        "WebMCP es el puente entre las páginas de los carriers y una operación B2B que tu equipo puede entender y supervisar.",
      steps: [
        { number: "01", title: "Define tu FreightRequest", description: "Indica origen, destino, carga y ventana para expresar la necesidad real de transporte." },
        { number: "02", title: "Consulta con WebMCP", description: "El agente visita carriers registrados y consulta sus capacidades mediante herramientas estructuradas." },
        { number: "03", title: "Compara con evidencia", description: "Las respuestas se validan, persisten y ordenan con un ranking reproducible y explicable." },
        { number: "04", title: "Reserva y recupera", description: "Tu equipo selecciona una opción; si el carrier rechaza, la operación puede continuar con recovery." },
      ],
    },
    value: {
      eyebrow: "Diseñada para operar",
      title: "Claridad para decidir. Continuidad para entregar.",
      items: [
        { title: "Más allá de una lista cerrada", description: "La arquitectura incorpora 0..N carriers registrados sin reglas escondidas por nombre." },
        { title: "La evidencia acompaña la decisión", description: "Navegación, tools, persistencia y ranking permanecen visibles para revisión humana." },
        { title: "La operación no termina en el booking", description: "Los rechazos recuperables mantienen el contexto para encontrar una alternativa autorizada." },
      ],
    },
    cta: {
      eyebrow: "Empieza con una decisión real",
      title: "Mira cómo una solicitud se convierte en una operación trazable.",
      description: "Accede a la demo y recorre el flujo completo desde el control tower.",
      button: "Probar la demo",
    },
    footer: "CargoMesh · WebMCP Challenge 2026",
    footerNote: "Orquestación B2B con evidencia en cada paso",
  },
  en: {
    brand: { name: "CargoMesh", label: "Control tower" },
    nav: { ariaLabel: "Main navigation", homeLabel: "CargoMesh home", howItWorks: "How it works", signIn: "Sign in" },
    hero: {
      eyebrow: "Freight orchestration · WebMCP",
      title: "Clear freight decisions, from request to destination.",
      description: "CargoMesh connects your freight intent with each carrier's real capabilities so your team can decide, book, and recover with evidence.",
      primaryCta: "Try the demo",
      secondaryCta: "How it works",
      signalsLabel: "CargoMesh principles",
      signals: ["Open registry", "Structured responses", "Auditable decisions"],
      visualLabel: "Orchestration flow summary",
      visual: {
        eyebrow: "Orchestration flow", status: "Ready to decide", originLabel: "Origin", origin: "Callao / Lima", destinationLabel: "Destination", destination: "Santiago", discovery: "Registered carriers", discoveryValue: "0..N", evidence: "WebMCP evidence", evidenceValue: "Verified", ranking: "BALANCED ranking", rankingValue: "Reproducible", confidenceLabel: "Decision confidence", confidence: "88 / 100", traceabilityTitle: "Full traceability", traceabilityDescription: "Every step keeps its evidence",
      },
    },
    flow: {
      eyebrow: "How it works", title: "One traceable decision from start to finish.", description: "WebMCP bridges carrier websites with a B2B operation your team can understand and supervise.",
      steps: [
        { number: "01", title: "Define your FreightRequest", description: "Set origin, destination, cargo, and timing to express the real transportation need." },
        { number: "02", title: "Query through WebMCP", description: "The agent visits registered carriers and queries capabilities through structured tools." },
        { number: "03", title: "Compare with evidence", description: "Responses are validated, persisted, and ordered with an explainable, reproducible ranking." },
        { number: "04", title: "Book and recover", description: "Your team selects an option; if a carrier rejects it, the operation can continue through recovery." },
      ],
    },
    value: {
      eyebrow: "Built for operations", title: "Clarity to decide. Continuity to deliver.",
      items: [
        { title: "Beyond a closed list", description: "The architecture supports 0..N registered carriers without hidden name-based rules." },
        { title: "Evidence stays with the decision", description: "Navigation, tools, persistence, and ranking remain visible for human review." },
        { title: "Operations do not end at booking", description: "Recoverable rejections keep context to find an authorized alternative." },
      ],
    },
    cta: { eyebrow: "Start with a real decision", title: "See how a request becomes a traceable operation.", description: "Open the demo and walk through the full flow from the control tower.", button: "Try the demo" },
    footer: "CargoMesh · WebMCP Challenge 2026",
    footerNote: "B2B orchestration with evidence at every step",
  },
} as const;

export const landingCopyEs = landingCopy.es;
export type LandingLocale = keyof typeof landingCopy;
