# HAC-15 → HAC-14 — Handoff de integración ROAD

Fecha: 1 octubre 2026 (America/Lima). Juan entrega el mapa; Luis posee el intake, su estado y mapper; QA valida el smoke integrado. [PR #92](https://github.com/Chujutak2024/cargomesh/pull/92) permanece en revisión. **Sin merge ni despliegue.**

## 1. Snapshot y autoridad

| Fuente | Snapshot leído |
| --- | --- |
| Rama Juan | `feat/fe2-v2-route-map`; código revisado: `2c5cc8de7005b1cc5531296f64e56ba4920ebb49` |
| HEAD recibido en #92 | `84273220a42209dbcf591f6c3aed5468eed16af9` |
| Target de #92 | `feat/cycle-2-integration` — `f2a8e3eb441e7bdd35718e7c69192256c6aaf553` |
| Base contractual | `codex/v2-amazon-contracts` — `66a195207379f6f6be3eafd7ace02d254e7cf1c8` |
| Rama Luis, inspección solamente | `feat/fe1-v2-intake-eligibility` — `226624e3bcf4c7856c7aa21fcbeed9eaaf93ab18` |
| Instrucciones | `AGENTS.md` y `docs/v2-amazon/README.md` |
| Contrato maestro | [HAC-27, §6.1](https://linear.app/hackatonteamcargomesh/document/hac-27-mapeo-57-clases-v2-a-bdapi-patrones-atomicidad-y-contratos-v20-d2a9ef6d0876), actualización `2026-09-28T02:28:16.522Z` |

HAC-15 está `In Review`. Al consultar #92 no había hallazgos humanos ni threads de revisión: sólo comentarios de Linear/Vercel. Las correcciones de esta entrega proceden de la auditoría propia y el smoke local. No se incorporó la rama de Luis ni se creó una integración paralela.

## 2. Punto exacto de montaje para Luis

En el snapshot de Luis:

- `cargomesh/src/features/v2-intake/v2-intake-prototype.tsx:108–116` ya construye `mapProps` con el mapper.
- En `:345` renderiza `CandidateResults` con la misma selección del padre.
- En **`:346`**, después de las tarjetas y dentro de `integrationArea`, monta `RoadCandidateMapBoundary`.
- El archivo que hay que reemplazar es **`cargomesh/src/features/v2-intake/components/road-candidate-map-boundary.tsx`**. Mantener el caller y sustituir la presentación provisional por el componente real de Juan:

```tsx
"use client";

import { RoadCandidateMapView } from "@/features/v2-road-map/road-candidate-map-view";
import type { RoadCandidateMapViewProps } from "../contracts";

type Translate = (spanish: string, english: string) => string;

export function RoadCandidateMapBoundary({ props }: {
  props: RoadCandidateMapViewProps;
  t: Translate; // Conserva la firma del caller existente.
}) {
  return <RoadCandidateMapView {...props} />;
}
```

Este fragmento es la acción propuesta para **Luis durante la integración autorizada**. No se aplicó a su rama. El componente real está en `cargomesh/src/features/v2-road-map/road-candidate-map-view.tsx`; estilos y renderer quedan encapsulados. Requiere el `LocaleProvider` existente. No envolver el mapa con un nuevo proveedor de idioma ni usar una `key` que cambie con cada candidato: eso recrearía el renderer.

El layout del mapa apila candidatos y mapa a ≤900 px y pasa los datos de ruta a dos columnas a ≤600 px. No requiere imponer un split-view fijo al layout del intake.

## 3. Props y selección: un único dueño

| Prop | Fuente | Regla |
| --- | --- | --- |
| `origin`, `destination` | `request.origin/destination` de GET V2 | Coordenadas y sedes canónicas; `lat/lng` admiten `null`. No geocodificar nombres para rellenarlas. |
| `overallStatus` | `evaluation.overallStatus` | El mapa presenta la evaluación; no la calcula. |
| `candidates` | `evaluation.candidates` | Conservar IDs y objetos `carrier/service`; alias `carrierName = carrier.commercialName`, `serviceCode = service.code`; `routePreview ?? null`. |
| `selectedCandidateId` | Estado de HAC-14 | `string | null`; mismo valor para tarjetas y mapa. |
| `onSelectCandidate` | Callback de HAC-14 | Actualiza **ese mismo** estado; el mapa no guarda otra selección. |

El mapper inspeccionado es `cargomesh/src/features/v2-intake/mappers/road-map-props.mapper.ts`. Su firma real tiene cuatro argumentos, incluyendo selección y callback:

```tsx
const mapProps = useMemo(() => {
  if (!request || !evaluation) return null;
  return mapServiceabilityToMapViewProps(
    request, evaluation, selectedCandidateId, setSelectedCandidateId,
  );
}, [request, evaluation, selectedCandidateId]);

// Ambos controles consumen el mismo estado.
<CandidateResults evaluation={evaluation}
  selectedCandidateId={selectedCandidateId}
  onSelectCandidate={setSelectedCandidateId} t={t} />
{mapProps ? <RoadCandidateMapBoundary props={mapProps} t={t} /> : null}
```

El selector compacto del mapa también llama al mismo callback. Mantener las tarjetas completas de Luis: contienen checks y `commercialNotice` que el mapa no sustituye. Si se simplifica la duplicación visual de selectores, debe hacerse como presentación acordada; nunca con un segundo estado.

### Ciclo de vida de la evaluación

Luis conserva la selección inicial que ya establece en `readAndEvaluate` (`:195–198`: primer elegible, luego primer candidato, luego `null`). Juan **no** replica esa política. Si una respuesta nueva elimina el ID seleccionado, el padre debe resolverlo o poner `null`; el mapa no selecciona silenciosamente el primero.

Antes de mostrar una evaluación, comprobar en el controller de HAC-14 que `evaluation.freightRequestId === request.id` y `evaluation.evaluatedDraftVersion === request.draftVersion`. Descartar respuestas antiguas tras cambios rápidos, reset o cambio de solicitud. Esto queda para el smoke integrado; no se ha corregido código ajeno.

Una edición local posterior al GET no cambia las coordenadas del request persistido. Mantener visible `dirtyAfterCreate` y la versión evaluada, o invalidar la evaluación hasta leer la versión nueva. No combinar coordenadas del formulario editado con una geometría del request anterior. No usar `useEffect` para copiar selección o draft entre componentes.

## 4. Cómo conectar `/v2-workspace` sin otro borrador

**Estado actual:** `/v2-workspace` es una UI de escenario local; aún no consume el controller/API de HAC-14. Su registro `V2-LOCAL-01` no es un `DRAFT` del servidor. Esta entrega documenta la migración; no declara que ya ocurrió.

Puntos actuales en `cargomesh/src/features/v2-workspace/workspace.tsx`:

| Punto | Acción en la versión conectada, dueño Luis |
| --- | --- |
| `:44` — `useState<WorkspaceDraft>(initialDraft)` | Sustituir por el draft de HAC-14 y sus acciones. No conservar ambos. |
| `:48` — selección `road-scenario` | Consumir `selectedCandidateId/onSelectCandidate` del mismo controller de HAC-14. |
| `:57` / `:69` — lectura/escritura del draft local | Dejar de leer/escribir esa key en la versión conectada. La persistencia V2 procede de POST/GET y su versión. |
| `:101` — `mapPropsForDraft` | Sustituir por `mapServiceabilityToMapViewProps(request, evaluation, selection, callback)`. |
| `:227` — paso de ruta | Recibir esas `mapProps`; antes de persistir/evaluar mostrar pendiente, sin candidatos inventados. |
| `:236` — tracking | Reutilizar las mismas `mapProps` y versión; no crear otro draft o selección al navegar. |

Extraer el controller actualmente alojado en `V2IntakePrototype` a un único hook/context de HAC-14 o pasarlo por props a la presentación del workspace. **Ese hook/context todavía no existe en #92**; su creación corresponde a Luis. El shell, dashboard, formulario y tracking deben consumir una única instancia, montada por encima de las vistas que la comparten.

Secuencia propuesta:

1. Separar presentación del workspace de su adaptador de escenario. Mantener escenario y modo conectado como entradas explícitas, sin fallback automático ante error de autenticación/API.
2. Alimentar sedes, categorías, equipo, contactos y ventanas desde el catálogo y draft tipado de HAC-14. `WorkspaceDraft` simplificado no es el payload V2: no castearlo al DTO.
3. Crear y releer mediante las acciones existentes de HAC-14. Usar la evaluación del mismo request/versión para tarjetas, mapa y resumen.
4. Actualizar las vistas con props derivadas de ese controller. Pueden seguir siendo locales idioma, navegación, filtros o preferencia visual; **no** otra solicitud, evaluación ni selección.
5. Probar navegación Panel → Solicitud → Seguimiento y retorno: conservar el mismo ID/draftVersion, selección y estado de cambios sin guardar. Recargar debe seguir la política de restauración de HAC-14, no restaurar `V2-LOCAL-01` como request persistido.

No importar silenciosamente el almacenamiento `cargomesh-v2-react-workspace-draft` al POST. Sus IDs de sede (`callao/arequipa/piura`) son fixtures, no facility UUIDs autorizados. Cualquier importación futura requiere confirmación visible, resolución contra `intake/options` y validación completa. No borrar el draft local para completar este handoff.

## 5. Datos, geometría y proveedor

**Actualización local posterior, 1 octubre 2026:** a petición de Juan el workspace retiró la línea de tres puntos y dispone de un adaptador local opcional Google Routes, separado de serviceability/HAC-14. [Implementación, evidencia y límites actuales](./HAC15_GOOGLE_ROAD_PREVIEW_LOCAL.md). No cambia las seis props ni autoriza a Luis a sustituir su mapper por el endpoint de escenario.

**Ampliación posterior del catálogo:** Juan pidió otros continentes y transporte sólo por tierra. [34 ciudades / 18 países y evidencia multirregional](./HAC15_MULTICONTINENT_ROAD_CATALOG.md). Los selectores de `road-locations.ts` y su prefiltro de redes terrestres pertenecen únicamente al escenario local. No son sedes comerciales ni nuevas reglas de elegibilidad de HAC-12; Luis debe sustituirlos por su catálogo/mapper en modo conectado. Se rechazan ferris y trayectos no DRIVE sin fabricar líneas.

| Superficie | Datos / estado real |
| --- | --- |
| `/v2-workspace` actual | Un draft del navegador, catálogo de referencia multirregional. Un par de red terrestre compatible puede tener un candidato de presentación `unknown`, sin transportista real ni oferta. Si el adaptador local autorizado obtiene respuesta ROAD sin ferris: `GOOGLE_ROUTES_API / ESTIMATED`, geometría y métricas del proveedor. Si no: preview null y ninguna línea. Redes desconectadas: bloqueo y cero candidatos, sólo pines. Los extremos siguen siendo coordenadas de referencia. |
| `/hac15-preview` | Fixtures locales de contrato y control padre de prueba. No usa las tarjetas de Luis ni llama a freight API/DB. Sus 1 015 km / 18,5 h son valores del fixture, **no** mediciones Google Routes. |
| Integración futura | Request/evaluación de HAC-12 mediante HAC-14; procedencia que realmente devuelva el contrato. El basemap no transforma esa procedencia en `VERIFIED`. |

Reglas verificadas:

- `routePreview:null`, `UNKNOWN`, `legs:[]`, waypoints vacíos/inválidos o fuente ausente: ninguna polilínea, métricas no disponibles y geometría efectiva **`UNKNOWN`**.
- Coordenada canónica de un extremo ausente: sólo el pin del extremo conocido; ningún trazado. Ambos extremos ausentes: estado vacío sin renderer.
- Cero candidatos o ID eliminado/no seleccionado: no seleccionar el primero ni inventar geometría. Mantener los pines canónicos conocidos.
- Los legs válidos se dibujan por separado; no se crea una unión artificial entre ellos.
- La nota inferior usa el renderer real y la fuente declarada utilizable. No expone keys, endpoints, proyecto ni errores HTTP. Se mantiene la atribución nativa.
- La restricción de fallback para contenido Google Routes aplica también al **cambio de selección** y a la carga asíncrona de Leaflet, no sólo al primer montaje.

En esta sesión Google rechazó `127.0.0.1:3093` con `RefererNotAllowedMapError`; el contenido simulado se mostró sobre **OpenStreetMap**. No se cambió la key, el proyecto ni sus restricciones. Al seleccionar el fixture `Fuente Google / sin traza` (`UNKNOWN`, `legs:[]`) se retira el fallback y aparece proveedor no disponible. No hubo consulta Google Routes ni geometría creada para hacer pasar ese caso.

**Revalidación del 1 octubre 2026:** la misma app React/Next en el origen ya autorizado `127.0.0.1:8080` cargó **Google Maps**, que sigue siendo el proveedor principal. [Captura directa del workspace con Google](./evidence/hac15-handoff/10-google-workspace-8080-es.jpg): teselas, pines, logo, términos, atribución y nota «Mapa: Google Maps Platform · Geometría simulada». Sin errores de consola en esta comprobación; sólo aviso de deprecación de Marker. El rechazo de 3093 es específico de ese origen y no prueba ausencia del renderer Google. La línea continúa siendo **SIMULATED**, sin consulta Google Routes. No se cambió código, key ni Google Cloud.

Ver [ADR existente](../HAC15_MAP_PROVIDER_ADR.md). El piloto de ruteo para camión/TomTom, restricciones Perú/MTC, geocodificación y validación de una ruta real siguen pendientes; estas capturas no los certifican. Tampoco prueban aptitud de camión, cobertura, capacidad, precio, booking, despacho ni GPS.

El DTO de props §6.1 no incluye `evaluatedAt` ni `serviceClass`. En la integración Luis/QA deben conservar esos datos de la evaluación/servicio en la presentación externa: fecha y versión reales; FTL/LTL/UNKNOWN desde el servicio, sin inferir vehículo. No añadirlos al mapa desde fixtures ni completar un dato faltante con el reloj del navegador.

## 6. Correcciones y evidencia de Juan

| Hallazgo propio | Corrección |
| --- | --- |
| Fuente vacía o preview sin geometría conservaba una etiqueta demasiado afirmativa | Fuente normalizada, geometría efectiva `UNKNOWN`, métricas ocultas y etiqueta explícita. |
| Cambiar desde OSM a fuente Google Routes eludía el guard del primer montaje | Guard en actualización del adapter, transición de renderer y comprobación después del import asíncrono. |
| `role=img` aplanaba los controles de un mapa interactivo; overlays recibían foco sin acción | Región accesible, controles/atribución navegables, overlays informativos sin foco y etiquetas de pines visibles. |
| Foco de poco contraste / fuente no anunciada | Outline de 3 px oscuro y nota del proveedor con `aria-live=polite`; renderer fallido oculto al teclado. |

[Índice de evidencia y reproducción](./evidence/hac15-handoff/README.md): nueve capturas del smoke local en 3093 y una captura adicional de Google Maps en 8080, [19 comprobaciones de interacción](./evidence/hac15-handoff/interaction-results.json), consola sanitizada y resultados de tests. No es un acta del smoke conjunto ni una certificación WCAG completa.

## 7. Smoke conjunto con Luis y QA — pendiente

| Paso | Owner | Resultado exigido |
| --- | --- | --- |
| Sustituir boundary provisional en `:346` | Luis | Typecheck/build del snapshot integrado; mapper sin casts ni DTO paralelo. |
| POST → GET → serviceability local autorizado | Luis / BE / QA | ID/draftVersion coincidentes; origen/destino del GET, evaluación real y `commercialNotice` conservado. |
| Tarjeta ↔ mapa, reset y respuesta nueva | Luis / Juan / QA | Un único ID seleccionado; callback bidireccional, sin re-mount por selección y sin respuestas obsoletas. |
| Edición y navegación por workspace | Luis / QA | Un único draft; cambios no persistidos claramente rotulados; nunca mezclar versiones de geometría. |
| Null, UNKNOWN, legs vacíos, coordenadas ausentes, cero candidatos | Juan / QA | Comportamiento de §5; repetir con los envelopes del entorno conjunto. |
| Callao→Arequipa; Piura→Arequipa; B→A / tenant | BE / Luis / QA | Usar fixtures/IDs publicados de HAC-12/29. No convertir el empty state local en PASS de elegibilidad ni 403 de tenant. |
| Proveedor autorizado y fallo de proveedor | Juan / QA | Atribución y nota correctas; ningún trazado fabricado; documentar renderer/fuente y entorno. |
| Teclado, ES/EN, 320/390 px y escritorio | Juan / QA | Selección con Enter/Space, foco visible, salida de mapa sin trap y sin overflow horizontal. |
| Fecha/versionado y FTL/LTL/UNKNOWN | Luis / QA | Valores de respuesta, sin inferencias; registrar cualquier dato no disponible. |

Registrar fecha, SHAs integrados, owner QA, request/version, proveedor real y evidencia al ejecutar el smoke. **QA-13-20 permanece pendiente hasta esa ejecución y aceptación.** No marcar HAC-15 `Done` por este documento.

## 8. Estado de entrega

**Handoff y evidencia local preparados para revisión/smoke conjunto. Integración HAC-14/API/DB y aceptación QA pendientes.**

MERGES: NINGUNO · DESPLIEGUES: NINGUNO · SUPABASE REMOTO: SIN CAMBIOS · VERCEL/GOOGLE CLOUD: SIN CAMBIOS. Las correcciones se entregan únicamente en la rama de Juan y #92.
