# HAC-41 — Identidad y flujo completo MCP

Entrega para revisión desde `codex/v2-full-identity-mcp`, sobre `codex/v2-amazon-contracts@1e9ff995ef9c8fa6789e473263e64873bcb13fba` (tras #112). Implementación por el integrador con autorización expresa del Tech Lead del 8-oct-2026; Axel conserva la responsabilidad de HAC-41 y la revisión del alcance. El SHA evaluado se registra en el PR y Linear, sin presumir merge ni Done.

## Archivos y migraciones

Tres migraciones aditivas llevan la cadena local de 23 a 26:

- `20261008235124_hac41_identity_integrations.sql`: metadatos, permisos, linking, directorios, configuración y diagnóstico.
- `20261008235540_hac41_carrier_workflow.sql`: principal carrier independiente, recibos propios y emisor de oferta. Conserva las funciones de dominio con dispatch de actor/recibo; usa los bindings de recursos aceptados en F-05.
- `20261009000410_hac41_mcp_channels.sql`: propuestas/confirmaciones privadas y candidatos de localización.

Manifest con hashes de contenido LF, tipos generados desde el catálogo local y test 33 registrado en el perfil V2. Las migraciones previas conservan sus bytes. Los dos operadores de escenario pertenecen al seed sintético; la migración no provisiona usuarios, clientes, grants ni datos comerciales.

Los servicios nuevos están en `cargomesh/src/server/modules/identity`, `modules/locations` y `modules/workflow/application/confirmed-workflow-service.ts`; repositorios usan el token de usuario. Hono y MCP comparten esos servicios, sin una llamada interna MCP→REST. El [contrato de identidad](../contracts/IDENTITY_AND_MCP_CHANNELS.md) define el comportamiento y los límites.

## HTTP canónico

Todas las rutas siguientes llevan prefijo `/api/v2`. Las mutaciones de identidad usan `Idempotency-Key` UUID, versión esperada donde corresponde y DTOs cerrados.

| Método/ruta | Operación |
|---|---|
| GET `/organizations/current/members` | Directorio: OWNER ve organización; otros ven su identidad. |
| POST `/organizations/current/members/invitations` | Invitación a usuario Auth existente; REQUESTER/SUPERVISOR. |
| POST `/organizations/current/members/:id/revisions` | Cambio de rol/estado autorizado y versionado. |
| POST `/identity/organizations/:organizationId/members/:id/acceptance` | Aceptación del propio usuario verificado. |
| GET `/carriers/:carrierId/operators` | Operadores del carrier autorizado. |
| POST `/carriers/:carrierId/operators/invitations` | Invitación por ADMIN. |
| POST `/carriers/:carrierId/operators/:id/revisions` | ADMIN administra rol/estado; no autoeleva sus permisos. |
| POST `/carriers/:carrierId/operators/:id/acceptance` | Usuario invitado acepta; requiere grant del servidor. |
| GET/POST `/identity/mcp/links` | Historia propia / consentimiento a cliente verificado. |
| POST `/identity/mcp/links/:id/revocations` | Revocación propia versionada. |
| GET/POST `/carriers/:carrierId/integrations` | Configuración segura por servicio/canal. |
| GET `/carriers/:carrierId/integrations/:id/diagnostics` | Estado y bloqueo; sin credenciales ni prueba live. |
| POST `/locations/resolutions` y `/locations/confirmations` | Resolver y confirmar candidato propio/versionado. |

Las rutas comerciales/operativas `/carriers/:carrierId/...` existentes conservan sus URL y pasan a `carrier-workflow.ts`: oportunidades, ofertas, booking, holds, ejecuciones, incidentes, eventos, consolidaciones, límites y métricas. Autorizan CarrierOperator sin exigir membresía shipper. Catálogo/flota/crew administrativo conserva su contrato anterior; el smoke configura crew mediante un administrador de catálogo, y el carrier independiente confirma/inicia la operación.

## Tools MCP implementadas

El catálogo V2 registra 18 tools en este corte; la cantidad no es un criterio fijo de aceptación.

| Familia | Tools |
|---|---|
| Capacidades e intake existentes | `get_cargomesh_capabilities`, `get_v2_intake_options`, `create_v2_freight_request`, `get_v2_freight_request`, `evaluate_v2_road` |
| Solicitudes | `list_v2_freight_requests`, `revise_v2_freight_request`, `submit_v2_freight_request` |
| Planner y planes | `find_v2_route_alternatives`, `replan_v2_route`, `explain_v2_route`, `build_v2_transport_plan` |
| Comercial y seguimiento | `rank_v2_offers`, `read_v2_workflow`, `prepare_v2_commercial_action`, `confirm_v2_commercial_action` |
| Lugares | `resolve_v2_location`, `confirm_v2_location` |

Preparar/confirmar usa las acciones de `mcp-workflow.ts`: oportunidades, ofertas, decisiones, bookings, holds, ejecuciones, incidentes y consolidaciones. Los DTOs conservan versión, idempotencia, fuente, organización/carrier y estados nativos. Las tools no publican ofertas inventadas ni saltan guardas comerciales. El transporte es POST Streamable HTTP sin sesión persistente; `structuredContent` y errores no exponen secretos.

## Validación reproducible local

Entorno aislado: proyecto Docker `hac41-identity-mcp`, API loopback 64321, PostgreSQL 64322, CLI Supabase 2.117.0; ninguna lectura/escritura al alojado. Baseline V2 + fixtures sintéticos de tests 22/33, usuario exclusivamente carrier sin OrganizationMember, cliente OAuth descartable registrado mediante Auth Admin.

| Gate | Resultado local |
|---|---|
| Cadena de migraciones | 26/26; las 23 originales sin modificación. |
| pgTAP V2 | 976/976; test nuevo 33: 34/34. Cada archivo revierte sus datos; controles críticos evalúan constraints bajo authenticated. |
| Release TypeScript | 298/298. |
| Arquitectura y tipos | PASS; 174 módulos y 23 entradas client verificadas. |
| Bundle producción | PASS. |
| OAuth/HTTP/MCP | 21 grupos de controles; OAuth Supabase PKCE real local, sin JWT confeccionado ni service_role para dominio. |
| Drift | Comparación de 26 migraciones frente a catálogo público/privado: 0. |

Estos resultados y los conteos por archivo están en [HAC41_LOCAL_VALIDATION.json](./HAC41_LOCAL_VALIDATION.json); el PR/CI identifica el SHA final. El test local usa las mismas funciones Hono/MCP mediante Request/Response y conexiones HTTP reales a Auth/PostgREST. La prueba de CI previa HAC-40 también sirve la app Next por TCP; el nuevo smoke no acredita por sí solo un despliegue externo.

Comandos del perfil local/CI:

```sh
pnpm --dir cargomesh typecheck
pnpm --dir cargomesh check:architecture
pnpm --dir cargomesh test:release
pnpm --dir cargomesh build
python3 scripts/check-v2-full-model.py
python3 scripts/build-v2-full-der.py --check
python3 supabase-v2/gate.py v2 --evidence-dir "$RUNNER_TEMP/hac29-v2"
python3 scripts/check-hac40-workflow-http-ci.py
cd cargomesh
node --conditions=react-server --import tsx scripts/hac41-channels-http-smoke.mjs
```

El smoke exige banco local nominal y baseline sembrado; registra/elimina su cliente OAuth descartable. Se ejecuta una vez por banco limpio. Para el banco aislado fuera de CI: `HAC41_BANK_DIR=tmp/hac41-bank` y `HAC41_SUPABASE_CLI` opcional para el binario fijado. Al terminar la validación se reconstruye y detiene únicamente ese banco, descartando identidades/recibos sintéticos.

Controles principales: autorización propia/ajena, contraseña normal frente a OAuth, emisor carrier sin tenant ficticio, API/MCP ordinario denegado, confirmación propia/ajena, retry idéntico/conflictivo, dos confirmaciones simultáneas, rollback de conteos de todas las tablas de dominio, capacidad antes de booking, tripulación antes de salida, paridad Web/MCP de lugares/estado, versiones obsoletas y revocación inmediata. La configuración API queda PENDING con diagnóstico explícito.

## Trazabilidad UML y QA

[FULL_MODEL_CURRENT_IDENTITY.json](../models/FULL_MODEL_CURRENT_IDENTITY.json) mapea las cuatro clases y sus 28 atributos UML a columnas, DTOs, rutas/tools y responsable. El DER generado incorpora esa reconciliación y la relación 74 CarrierOperator→CarrierOffer, conservando las clasificaciones históricas del harness. Estado: implementación local verificada, pendiente de revisión independiente F-03/F-06 por HAC-44.

HAC-44 debe sincronizar el inventario desde el catálogo nuevo, reobservar estos atributos/relación y usar la ruta canónica de links. Este incremento no modifica sus matrices para forzar COMPLETO ni extiende silenciosamente su cobertura FK. El inventario y conteos anteriores pertenecen al SHA de #112.

## CI y límites de cierre

`v2-qa-gate.yml` incorpora el smoke PKCE al job V2. Los tres jobs obligatorios son aplicación, V1 histórico y V2. Su resultado por SHA se registra en el PR/Linear; no se infiere de los resultados locales.

Pendientes externos: aplicación autorizada de las tres migraciones al alojado, configuración del cliente/issuer/registry y permisos administrativos mínimos allí, UI de consentimiento OAuth y conexión Web/portal a las nuevas rutas, reprobar el preview y el canal MCP público. Alexa+ live continúa bloqueado por acceso del proveedor; geocoder externo y adapters carrier API/MCP no se declaran live. Véase [friction log HAC-41](./friction-logs/HAC41_OAUTH_CHANNEL_BOUNDARY.md).

El paquete alojado validado antes de esta rama tiene 23 migraciones. Esta entrega local/CI no cambia ese paquete ni autoriza reutilizar su firma para 26 migraciones. Se entrega In Review; aceptación, merge y despliegue conservan sus pasos propios.
