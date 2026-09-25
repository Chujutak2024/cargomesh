# HAC-21 — mapeo aditivo de sedes y servicios ROAD V2

Estado: contrato de datos implementado en la migración `20260922053512_v2_road_facilities_services.sql`. Reset local y pgTAP ejecutados el 2026-09-22; PR #83 ya fue mergeado en `codex/v2-amazon-contracts` y HAC-21 figura `Done` en Linear. Su alcance no incluye account linking MCP ni servicios FreightRequest V2.

## Entidad → tabla → relación

| Entidad V2 | Tabla | Relación y regla |
|---|---|---|
| Sede/punto del shipper | `facilities` | `organization_id → organizations`; código único por organización. No se comparte entre shippers. |
| Depósito físico del carrier | `carrier_depots` | `carrier_id → carriers`; **no** crea cobertura. |
| Servicio comercial | `carrier_services` (existente) | Un carrier tiene `0..N` servicios. Las columnas de origen/destino heredadas de V1 no son autorización de cobertura V2. |
| Área de atención | `service_areas` | `carrier_service_id → carrier_services`; rol `PICKUP`/`DELIVERY`, inclusión/exclusión, granularidad, fuente propia/socio, evidencia y vigencia. |
| Lane ROAD dirigida | `service_lanes` | Servicio + área de recojo + área de entrega; FKs compuestas garantizan el mismo servicio y trigger valida roles/inclusión/modo. A→B no implica B→A. |
| Sede elegida en solicitud | `freight_requests.origin_facility_id` / `destination_facility_id` | FKs compuestas con `organization_id`; ambas opcionales para preservar solicitudes existentes y direcciones manuales. |

Las áreas pueden ser por país, región, ciudad o código postal; la exclusión más específica prevalece durante la evaluación, no por mera existencia de filas. `WITHIN_AREA` también requiere una lane explícita entre áreas de recojo y entrega con idéntica geografía. Los datos de socio requieren referencia, evidencia y vigencia, pero esta migración no valida un contrato externo del socio: esa confirmación sigue siendo responsabilidad del servicio de elegibilidad. Ubicación de sede, proximidad en el mapa o campos `origin_country`/`destination_country` de V1 nunca bastan.

### Cardinalidades y delta del esquema anterior

| Relación | Cardinalidad V2 | Delta frente al esquema anterior |
|---|---|---|
| `organizations` → `facilities` | 1 → 0..N | Antes la solicitud guardaba direcciones libres; no existía catálogo de sedes del shipper. |
| `organizations` → `organization_members` | 1 → 0..N | Se conserva el vínculo y sus roles para RLS; HAC-21 no modifica identidad. |
| `carriers` → `carrier_depots` | 1 → 0..N | Antes no se distinguía depósito físico de zona atendida. |
| `carriers` → `carrier_services` | 1 → 0..N | Se conserva la tabla; `origin_country/region` y `destination_country/region` legacy son metadatos V1, no V2. |
| `carrier_services` → `service_areas` | 1 → 0..N | Nuevas áreas de recojo y entrega, positivas o excluidas, con fuente y vigencia. Cero áreas significa cobertura V2 desconocida. |
| `carrier_services` → `service_lanes` | 1 → 0..N | Nuevas conexiones ROAD dirigidas. Cero lanes no permite inferir A→B ni B→A. |
| `service_areas` → `service_lanes` | 1 → 0..N por extremo | Cada lane exige exactamente un área `PICKUP` y una `DELIVERY` incluidas del mismo servicio; el extremo inverso requiere otra lane. |
| `freight_requests` → `facilities` | 0..1 origen + 0..1 destino | FKs compuestas por organización; valores nulos preservan solicitudes y direcciones manuales V1. |

Campos que no existían antes: identidad de sede por organización, dirección y coordenadas opcionales de sede/depot, granularidad y exclusión de zona, referencia de socio, evidencia/fecha/vigencia, dirección explícita de lane y referencias tenant-safe desde la solicitud. La tabla legacy `vehicles` no equivale a un calendario de capacidad V2; `carrier_metrics` y las tres ofertas de demo tampoco son ranking ni inventario V2.

## Acceso y persistencia

| Tabla | Lectura `authenticated` | Escritura `authenticated` |
|---|---|---|
| `facilities` | Miembro activo de la organización | `OWNER`/`SUPERVISOR` activos: alta y actualización de campos no propietarios; sin DELETE. |
| `carrier_depots`, `service_areas`, `service_lanes` | Cualquier miembro activo de alguna organización, como catálogo | Ninguna; solo backend con rol de servicio hasta diseñar identidad de carrier. |

`anon` carece de grants. Las cuatro tablas tienen RLS habilitado. Las FKs de sedes en `freight_requests` impiden referenciar una sede de otro tenant incluso si un escritor autorizado conoce el UUID. No se alteraron las políticas ni el flujo DRAFT→PENDING, `draft_version` o las claves de idempotencia.

## Contrato de decisión compartido

`cargomesh/src/types/v2-road-network.ts` define los registros y la salida `eligible | ineligible | unknown` con motivos, área/lane, evidencia y ventana. Es un **contrato**, no una implementación de búsqueda o promesa de capacidad. Una lane vigente es necesaria, pero no suficiente: estado de servicio, exclusiones, carga, permisos, calendario de flota, reserva y precio se evaluarán en servicios compartidos para Web/Alexa en los siguientes hitos. Un dato faltante o vencido se reportará como `unknown`; un rechazo confirmado como `ineligible`. No se presenta una oferta ni disponibilidad live a partir de este esquema.

Para Sprint 2 quedan decisiones de implementación explícitas: resolver precedencia de exclusión más específica y empates geográficos; fijar horizonte máximo entre `verified_at`, `valid_from` y `valid_until`; exigir confirmación registral del socio y documentos fronterizos; vincular flota/cupos, reservas y reposicionamiento a la ventana; decidir escritura del catálogo por identidad de carrier; y agregar estimación de ruta/costo sin convertirla en cotización. Hasta entonces, una combinación de área+lane no basta para `eligible` operativo.

## Corte de Sprint 1 y validación

- Migración aditiva y sin seeds V2 en `supabase/migrations/`; los tres carriers y FR-1042 históricos permanecen fixtures V1.
- `supabase/tests/09_v2_road_network.test.sql` cubre RLS, aislamiento, ownership, socio sin referencia, sede sin cobertura y dirección A→B sin B→A. Sus filas son transaccionales y hacen `rollback`.
- Comandos locales: `pnpm dlx supabase start`, `pnpm dlx supabase db reset`, `pnpm dlx supabase test db`; requieren Docker. Ejecutar además las pruebas existentes de idempotencia/DRAFT y `pnpm typecheck` en `cargomesh/`.
- Evidencia ejecutada sobre la rama HAC-21 basada en el HEAD V2 remoto: `pnpm dlx supabase db reset --local` aplicó todas las migraciones y el seed local sin errores; `pnpm dlx supabase test db` pasó 9 archivos y 183 aserciones (23 nuevas de ROAD); `pnpm typecheck`, `pnpm test:release` y las 4 pruebas Zod nuevas también pasaron. El reset se limitó a la instancia Docker `supabase_db_cargomesh`, que antes contenía únicamente ACME/FR-1042.
- Fuera de HAC-21: capacidad y reservas por fecha, flota, motor de elegibilidad completo, scoring, routing Google Maps, estimación de aduana, booking, seeds V2 y mutación del catálogo por carriers. Esos alcances requieren sus propias issues/contratos; ningún modo distinto de ROAD queda implementado aquí.

Véase [contrato de cobertura](../contracts/CARRIER_COVERAGE_AND_SERVICEABILITY.md) y [contratos de dominio](../contracts/DOMAIN_CONTRACTS.md).
