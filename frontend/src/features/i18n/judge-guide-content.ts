export type JudgeGuideCopy = {
  es: string;
  en: string;
};

export type JudgeToolScope = "intake" | "provider";
export type JudgeToolEffect = "read-only" | "state-changing";

export type JudgeToolGuide = {
  name: string;
  scope: JudgeToolScope;
  effect: JudgeToolEffect;
  readOnlyHint: boolean;
  destructiveHint?: true;
  untrustedContentHint: false;
  host: string;
  uiEntry?: string;
  description: JudgeGuideCopy;
  expected: JudgeGuideCopy;
};

export type JudgeFlowStep = {
  id: string;
  title: JudgeGuideCopy;
  description: JudgeGuideCopy;
  expected: JudgeGuideCopy;
  href?: string;
  linkLabel?: JudgeGuideCopy;
};

export const CANONICAL_APP_ORIGIN = "https://cargomesh.vercel.app";

export const CANONICAL_LOGIN_URL = `${CANONICAL_APP_ORIGIN}/login`;

export const CANONICAL_ANDES_PROVIDER_URL = `${CANONICAL_APP_ORIGIN}/providers/andes?serviceId=30000000-0000-0000-0000-000000000001`;

export const CANONICAL_INTAKE_URL = `${CANONICAL_APP_ORIGIN}/freight-request/new?requestCode=FR-1042`;

export const WEBMCP_CONSOLE_RUNBOOK_URL =
  "https://github.com/Chujutak2024/cargomesh/blob/main/docs/04-execution/WebMCP_Demo_Console_Runbook.md";

export const WEBMCP_PUBLIC_UAT_EVIDENCE_URL =
  "https://github.com/Chujutak2024/cargomesh/blob/main/docs/04-execution/REL02_Public_WebMCP_UAT_Evidence.md";

export const PROVIDER_TOOL_NAMES = [
  "check_service_coverage",
  "check_capacity",
  "quote_freight",
  "book_freight",
  "get_provider_booking_status",
] as const;

export const JUDGE_TOOL_GUIDE: readonly JudgeToolGuide[] = [
  {
    name: "get_freight_request_recommendations",
    scope: "intake",
    effect: "read-only",
    readOnlyHint: true,
    untrustedContentHint: false,
    host: CANONICAL_INTAKE_URL,
    description: {
      es: "Consulta antecedentes autorizados de la organización y propone campos para el borrador. La tool no aplica ni guarda cambios.",
      en: "Queries authorized organization history and proposes draft fields. The tool never applies or saves changes.",
    },
    expected: {
      es: "El usuario revisa fuente, motivo y diferencias, y decide campo por campo.",
      en: "The user reviews source, reason, and field diffs, then decides field by field.",
    },
  },
  {
    name: "check_service_coverage",
    scope: "provider",
    effect: "read-only",
    readOnlyHint: true,
    untrustedContentHint: false,
    host: CANONICAL_ANDES_PROVIDER_URL,
    description: {
      es: "Comprueba corredor, modo, tipo de servicio y categoría de carga antes de consultar capacidad.",
      en: "Checks corridor, mode, service type, and cargo category before capacity is requested.",
    },
    expected: {
      es: "Devuelve un resultado comercial supported true/false dentro de un envelope tipado.",
      en: "Returns a commercial supported true/false result in a typed envelope.",
    },
  },
  {
    name: "check_capacity",
    scope: "provider",
    effect: "read-only",
    readOnlyHint: true,
    untrustedContentHint: false,
    host: CANONICAL_ANDES_PROVIDER_URL,
    description: {
      es: "Valida peso, volumen, categoría y ventana de recojo contra la capacidad reportada por el provider.",
      en: "Validates weight, volume, category, and pickup window against provider-reported capacity.",
    },
    expected: {
      es: "Devuelve available true/false; capacidad insuficiente es un rechazo comercial, no un error técnico.",
      en: "Returns available true/false; insufficient capacity is a commercial rejection, not a technical error.",
    },
  },
  {
    name: "quote_freight",
    scope: "provider",
    effect: "read-only",
    readOnlyHint: true,
    untrustedContentHint: false,
    host: CANONICAL_ANDES_PROVIDER_URL,
    description: {
      es: "Genera una cotización estructurada con precio, moneda, tránsito, desglose y vigencia.",
      en: "Produces a structured quote with price, currency, transit, breakdown, and validity.",
    },
    expected: {
      es: "El Result Bridge valida la correlación y solo una cotización exitosa puede crear una oferta persistida.",
      en: "The Result Bridge validates correlation, and only a successful quote can create a persisted offer.",
    },
  },
  {
    name: "book_freight",
    scope: "provider",
    effect: "state-changing",
    readOnlyHint: false,
    destructiveHint: true,
    untrustedContentHint: false,
    host: CANONICAL_ANDES_PROVIDER_URL,
    uiEntry: "/dispatch/<runId>",
    description: {
      es: "Solicita la reserva de la oferta elegida con autorización e idempotencia generadas por el servidor.",
      en: "Requests booking for the selected offer with server-issued authorization and idempotency.",
    },
    expected: {
      es: "Debe ejecutarse desde Select/Seleccionar en CargoMesh; no se fabrica un payload de booking en DevTools.",
      en: "Run it from Select in CargoMesh; never manufacture a booking payload in DevTools.",
    },
  },
  {
    name: "get_provider_booking_status",
    scope: "provider",
    effect: "read-only",
    readOnlyHint: true,
    untrustedContentHint: false,
    host: CANONICAL_ANDES_PROVIDER_URL,
    uiEntry: "/booking/<bookingId>/status",
    description: {
      es: "Consulta estado, pago, ETA, ubicación nullable y eventos. En el fixture demo, el polling puede consumir la respuesta one-shot configurada y materializar CONFIRMED o REJECTED sin crear otro booking.",
      en: "Reads status, payment, ETA, nullable location, and events. In the demo fixture, polling can consume the configured one-shot response and materialize CONFIRMED or REJECTED without creating another booking.",
    },
    expected: {
      es: "La tool conserva readOnlyHint: true: consulta la reserva existente; Booking Bridge persiste la transición y un rechazo habilita una nueva selección explícita.",
      en: "The tool keeps readOnlyHint: true: it reads the existing booking; Booking Bridge persists the transition and rejection enables a new explicit selection.",
    },
  },
] as const;

export const JUDGE_FLOW_STEPS: readonly JudgeFlowStep[] = [
  {
    id: "sign-in",
    title: { es: "Inicia la sesión demo", en: "Start the demo session" },
    description: {
      es: "Abre Login y pulsa Entrar a CargoMesh. El acceso de un clic crea una sesión Supabase real con membresía ACTIVE; no escribas credenciales.",
      en: "Open Login and select Enter CargoMesh. One-click access creates a real Supabase session with ACTIVE membership; do not enter credentials.",
    },
    expected: { es: "Dashboard autenticado de ACME Mining.", en: "The authenticated ACME Mining dashboard." },
    href: CANONICAL_LOGIN_URL,
    linkLabel: { es: "Abrir Login", en: "Open Login" },
  },
  {
    id: "open-intake",
    title: { es: "Abre el caso canónico", en: "Open the canonical case" },
    description: {
      es: "Abre FR-1042 y revisa Callao → Santiago, 8,000 kg, 18 m³ y 10 pallets. No actives el modo de borrador vacío.",
      en: "Open FR-1042 and verify Callao → Santiago, 8,000 kg, 18 m³, and 10 pallets. Do not enable blank-draft mode.",
    },
    expected: { es: "Solicitud PENDING, sin ofertas precargadas.", en: "A PENDING request with no preloaded offers." },
    href: CANONICAL_INTAKE_URL,
    linkLabel: { es: "Abrir FR-1042", en: "Open FR-1042" },
  },
  {
    id: "review-history",
    title: { es: "Comprueba la recomendación de intake", en: "Check the intake recommendation" },
    description: {
      es: "Pulsa Consultar antecedentes / Review history. La tool read-only muestra fuente, motivo y diferencias; nada cambia sin consentimiento.",
      en: "Select Review history. The read-only tool shows source, reason, and diffs; nothing changes without consent.",
    },
    expected: { es: "Modal con revisión humana campo por campo.", en: "A field-by-field human review modal." },
  },
  {
    id: "start-orchestration",
    title: { es: "Inicia la orquestación", en: "Start orchestration" },
    description: {
      es: "Ve al paso Revisión / Review y pulsa Iniciar orquestación / Start orchestration. Espera a que el run termine; no hay ofertas precargadas en un dispatch vacío.",
      en: "Open the Review step and select Start orchestration. Wait for the run to finish; an empty dispatch contains no preloaded offers.",
    },
    expected: { es: "Navegación a /dispatch/<runId> y estado OPTIONS_READY o NO_MATCH según discovery 0..N.", en: "Navigation to /dispatch/<runId> and OPTIONS_READY or NO_MATCH based on 0..N discovery." },
  },
  {
    id: "inspect-provider",
    title: { es: "Inspecciona WebMCP nativo", en: "Inspect native WebMCP" },
    description: {
      es: "Esta es una URL técnica directa en otra pestaña, no una sección del menú. Abre Andes con su serviceId exacto; ejecuta getTools() y luego coverage read-only.",
      en: "This is a direct technical URL in another tab, not a sidebar section. Open Andes with its exact serviceId; run getTools(), then read-only coverage.",
    },
    expected: { es: "Cinco tools provider y un envelope con supported: true.", en: "Five provider tools and an envelope with supported: true." },
    href: CANONICAL_ANDES_PROVIDER_URL,
    linkLabel: { es: "Abrir provider Andes", en: "Open Andes provider" },
  },
  {
    id: "inspect-ranking",
    title: { es: "Revisa evidencia y ranking", en: "Review evidence and ranking" },
    description: {
      es: "Solo cuando el run llegue a OPTIONS_READY: abre Judge y expande el quote más reciente. Cierra este panel antes de comparar las tarjetas BALANCED.",
      en: "Only after the run reaches OPTIONS_READY: open Judge and expand the latest quote. Close this panel before comparing the BALANCED cards.",
    },
    expected: { es: "Andes 89, Inca 84, Pacific 72 y confianza 88.", en: "Andes 89, Inca 84, Pacific 72, and confidence 88." },
  },
  {
    id: "book",
    title: { es: "Selecciona y reserva", en: "Select and book" },
    description: {
      es: "Con las ofertas visibles, selecciona Andes explícitamente, espera el polling de estado y abre Evidencia para revisar Navigation, Tool, Persistence, Decision y Events.",
      en: "With offers visible, explicitly select Andes, wait for status polling, then open Evidence to inspect Navigation, Tool, Persistence, Decision, and Events.",
    },
    expected: { es: "Booking CONFIRMED y referencia del provider persistida.", en: "A CONFIRMED booking with its provider reference persisted." },
  },
  {
    id: "review-recovery",
    title: { es: "Revisa recovery verificado", en: "Review verified recovery" },
    description: {
      es: "Recovery requiere un reset destructivo autorizado y una corrida separada. La evidencia pública muestra Andes REJECTED → selección humana de Inca → CONFIRMED; no intentes resetear producción.",
      en: "Recovery requires an authorized destructive reset and a separate run. Public evidence shows Andes REJECTED → human Inca selection → CONFIRMED; do not attempt to reset production.",
    },
    expected: { es: "Dos bookings correlacionados, sin rebooking silencioso.", en: "Two correlated bookings with no silent rebooking." },
    href: WEBMCP_PUBLIC_UAT_EVIDENCE_URL,
    linkLabel: { es: "Abrir evidencia sanitizada", en: "Open sanitized evidence" },
  },
  {
    id: "verify-cleanup",
    title: { es: "Verifica cleanup", en: "Verify cleanup" },
    description: {
      es: "En la misma pestaña donde abriste el provider, navega a https://cargomesh.vercel.app/ y ejecuta allí el snippet de cleanup mostrado abajo.",
      en: "In the same tab where you opened the provider, navigate to https://cargomesh.vercel.app/ and run the cleanup snippet there.",
    },
    expected: { es: "remainingProviderTools debe ser [].", en: "remainingProviderTools must be []." },
  },
] as const;

export const WEBMCP_DISCOVERY_SNIPPET = `await (async () => {
  const expected = ${JSON.stringify(PROVIDER_TOOL_NAMES, null, 2)};
  const mc = document.modelContext;
  if (!mc) throw new Error("WebMCP is unavailable in this document.");
  const tools = await mc.getTools();
  const providerTools = tools.filter((tool) => expected.includes(tool.name));
  console.table(providerTools.map(({ name, title, description, origin }) => ({
    name, title, description, origin,
  })));
  if (providerTools.length !== expected.length) {
    throw new Error(\`Expected 5 provider tools; found \${providerTools.length}.\`);
  }
  return providerTools;
})();`;

export const WEBMCP_COVERAGE_SNIPPET = `await (async () => {
  const mc = document.modelContext;
  if (!mc) throw new Error("WebMCP is unavailable in this document.");
  const tools = await mc.getTools();
  const tool = tools.find((item) => item.name === "check_service_coverage");
  if (!tool) throw new Error("Tool not registered: check_service_coverage");
  if (tool.annotations?.readOnlyHint !== true) {
    throw new Error("Refusing to execute a non-read-only tool.");
  }
  const raw = await mc.executeTool(tool, JSON.stringify({
    origin: "Callao, PE",
    destination: "Santiago, CL",
    transport_mode: "ROAD",
    service_type: "FTL",
    cargo_category: "MACHINERY",
  }));
  const result = raw === null ? null : JSON.parse(raw);
  console.log(result);
  return result;
})();`;

export const WEBMCP_CLEANUP_SNIPPET = `await (async () => {
  const providerToolNames = new Set(${JSON.stringify(PROVIDER_TOOL_NAMES, null, 2)});
  const currentTools = await document.modelContext?.getTools?.() ?? [];
  const remainingProviderTools = currentTools
    .map((tool) => tool.name)
    .filter((name) => providerToolNames.has(name));
  console.log({ remainingProviderTools });
  return remainingProviderTools;
})(); // expected: []`;
