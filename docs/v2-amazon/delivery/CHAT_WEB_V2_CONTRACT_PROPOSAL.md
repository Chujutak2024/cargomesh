# Propuesta aislada · chat Web V2 (sin issue/ramificación aprobada)

Estado: **prototipo de diseño**, no superficie de producción ni evidencia de Alexa+ live. No forma parte del PR HAC-11. El manifiesto HAC-16 no asigna el chat y HAC-31 es el gate Sprint 3; HAC-33 es la implementación de lugares. Falta acordar issue, dueño FE (Luis/Juan), rama y target.

## Interfaz entre conversación y dominio

El componente React solo muestra `ConversationViewState` y emite acciones. Un controlador de conversación guarda el turno, solicita los datos faltantes y llama a un `ConversationDomainAdapter` del servidor. El adaptador de producción usará únicamente endpoints aprobados de HAC-12/HAC-33 y sesión de usuario. El adaptador de demostración usa datos **sintéticos rotulados** y jamás llama a un carrier ni genera precios u ofertas.

```ts
type PlaceReference =
  | { kind: "FACILITY"; facilityId: string }
  | { kind: "EXTERNAL_PLACE"; provider: string; placeId: string }
  | { kind: "COORDINATE"; latitude: number; longitude: number };

type PlaceCandidate = {
  reference: PlaceReference;
  label: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  precision: "exact" | "area" | "unknown";
  source: string;
  observedAt: string;
};

interface ConversationDomainAdapter {
  searchPlace(query: string, role: "origin" | "destination"): Promise<PlaceCandidate[]>;
  confirmPlace(input: {
    requestId: string;
    role: "origin" | "destination";
    reference: PlaceReference;
    expectedDraftVersion: number;
  }): Promise<{ requestId: string; draftVersion: number }>;
  evaluateRoad(requestId: string): Promise<{
    status: "eligible" | "ineligible" | "unknown";
    reasons: string[];
    source: string;
    observedAt: string;
  }>;
}
```

These are **proposed chat-facing types**, not final HAC-33 DTO names. Confirmation must be a separate human action with authorized identity, scope, tenant, version check, persistence and audit. An `EXTERNAL_PLACE` must not be silently converted into a `facilityId`. Geocoding alone proves neither coverage nor truck access, operating hours, ETA or price. If entry precision is insufficient, retain `unknown` and request a more precise address/pin.

## Conversation states and UX

`closed → ask_origin → choose_origin → ask_destination → choose_destination → ask_cargo/date → evaluate → result`. Candidate lists show source and precision, with an explicit numbered choice and separate confirmation. Zero results, ambiguity, stale draft and provider outage lead to recoverable error states. Keyboard: trigger opens panel and moves focus to heading/input; Escape closes and restores focus; Enter sends; candidate buttons are reachable in DOM order. Mobile panel fills the viewport below safe areas; desktop uses a bounded floating panel and scrollable history. Suggestions are actions, not assertions of capability.

The isolated [prototype](./prototypes/chat-v2/index.html) demonstrates layout, states and an unmistakable `SIMULACIÓN` badge. It does not call HAC-12/HAC-33. Quote, offer, booking and Alexa+ invocation remain unavailable. The production component should be mounted in a V2 route only after FE ownership and shared contracts are approved; the standalone file is not the final frontend deliverable.

## Alexa+ voice script (design only)

1. “¿Desde dónde recogemos la carga?” If multiple matches: “Encontré dos lugares. Uno: [name, area, source]. Dos: [name, area, source]. ¿Cuál eliges?”
2. “Elegiste [name]. ¿Confirmas este origen para la solicitud [code]?” Confirmation is tied to that exact pending action and version, then persisted and audited.
3. Repeat for destination; ask missing cargo, weight and pickup window in short turns.
4. Read ROAD status from the same service: “La elegibilidad es desconocida porque falta [reason], según [source, date].” Never substitute a drawn route for eligibility.
5. If asked for price or booking before a carrier offer exists: “Todavía no hay una oferta de transportista con precio confirmado ni una reserva disponible.”

An MCP test client can validate tools; it is not an Alexa+ live invocation.
