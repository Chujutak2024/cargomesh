# DTO desplegados y reprueba vigente — 9 octubre 2026

Producto probado/desplegado: **`29c385fe0ee501eb4b8b989b0a247c8fdeda62ad`**. Este informe sustituye los pendientes de alojamiento del informe original de d3a80eb. La publicación posterior agrega harness y documentación; no cambia el runtime desplegado.

## Ejecutado localmente @ 29c385f

- Runner completo: **2708 controles PASS**, dos ciclos completos, sin FAIL ni BLOQUEADO. Incluye gates nativos, PKCE real, HTTP, RLS, concurrencia, FK y cleanup. Typecheck y release PASS.
- Cadena de **27/27 migraciones**, drift 0 contra el baseline congelado; las 26 anteriores conservan sus hashes. Perfil pgTAP V2: **985/985**.
- Ampliación posterior de identidad: **56/56 casos HTTP y 8 roundtrips concretos**, sesiones Auth reales y OAuth PKCE S256. Llega a COMMIT bajo authenticated con claims comprobados por el emisor. Incluye roles, tenant, versiones, invitaciones, integración, consentimiento/revocación y localización.
- El fixture carrier conserva la precondición del grant independiente: invitación sola rechazada; grant provisionado por el servidor y aceptación propia permitida. No se modifica el contrato para obtener PASS.
- Harness publicado: identity.py / identity_evidence.mts, registro en run.py y lectura de identity-api-results.json en matrices. CLI reutiliza el lanzador portable de PKCE, sin shell ni exposición de status/claves.

### Matrices actuales y clasificación

| Inventario | Resultado medido |
|---|---|
| 225 endpoints | 225 IMPLEMENTADO: positivo funcional y anónimo 401 por ruta; no certifica todos sus campos/estados |
| 397 atributos | 297 COMPLETO, 97 PARCIAL, 3 DIVERGENTE |
| 93 relaciones | 51 COMPLETO, 42 PARCIAL |
| 57 clases | 1 COMPLETO, 55 PARCIAL, 1 DIVERGENTE |
| 146 métodos | Mapeados a operaciones relacionadas; semántica exacta pendiente |

Las **198 filas pendientes** se clasifican en **194 de evidencia pendiente** y **4 documentales** (tres atributos legacy de McpAccountLink y su clase agregada). No hay defectos funcionales nuevos confirmados por esta ejecución. Los dos defectos R01/R02 del corte original están corregidos y reprueban en local y alojado. Los CSV actuales están en [29c385f/](./29c385f/RESULTADO.json); los CSV superiores conservan el corte original y no se sobrescriben.

**F-02 sigue parcial.** El cierre del despliegue y los endpoints no certifica 97 campos, 42 asociaciones ni 146 métodos. El archivo [CLASIFICACION_PENDIENTES.csv](./29c385f/CLASIFICACION_PENDIENTES.csv) deja dueño y criterio por fila; una falta de evidencia no se convierte en una orden de reimplementar backend. No se modificó el UML 07 histórico ni se fijaron estados a mano.

## Alojado / preview

- Preview: [CargoMesh QA V2](https://cargomesh-hac41-qa-anjuje.vercel.app), deployment `dpl_4ZVwp2u8CT9HTofcMtLwCimZwh5f`, READY en 29c385f.
- Supabase cargomesh-v2: **27/27**, historial exacto; migración aditiva de proyección aplicada antes del DTO. Datos de negocio sin cambios durante la migración, helpers privados sin EXECUTE para anon/authenticated/service_role.
- **Smoke 21/21 PASS**, OAuth PKCE real y servicios compartidos HTTP/MCP: solicitud → alternativas → plan → oportunidad → oferta carrier → ranking/selección → booking → holds comprometidos → confirmación carrier → crew → ejecución **IN_PROGRESS**.
- RouteWaypoint.sequence devuelve 1,2 en orden. Booking crea/lee data.decisionId igual a la decisión persistida. Ambos con lectura propia, tenant ajeno 404 y anónimo 401. Se prueban reintentos idénticos/conflictivos, confirmación concurrente y errores sin filas parciales.
- Datos de carriers **SIMULATED**, proveedor OAuth OTHER. Esto no certifica Alexa+ live ni un adaptador de carrier externo.
- Al terminar: ejecución/booking sintéticos CANCELLED, hold RELEASED; C **OPERATOR/INACTIVE**, grant revocado, links MCP revocados, cliente QA deshabilitado, sesiones cerradas, bypass temporal de Vercel revocado. UUID/permisos A/B conservados. Los JWT de acceso emitidos vencen como máximo **2026-10-09T18:50:21.000Z**; cierre de sesión no se presenta como revocación criptográfica inmediata del JWT. Los permisos/link revocados sí se verifican por llamada.
- **4 respaldos restaurados**, 80 tablas iguales por conteo/hash, catálogo/ACL/RLS iguales; sin credenciales, sesiones ni filas Auth restauradas. Copias de restauración locales eliminadas y banco detenido. main, productionBranch, rootDirectory y tres aliases de producción sin cambios.

## Incidencias de ejecución y límites

1. Primer intento local bloqueado por puertos reservados de Windows; evidencia conservada en f02-29c385f. La ejecución válida usa bancos propios f02-final09 y puertos preflight libres.
2. Primer smoke alojado se detuvo por versión de política repetida en el fixture (409 WORKFLOW_CONFLICT). Accesos retirados; segundo intento usa versiones únicas y pasa. Evidencia del intento fallido conservada.
3. Primera medición adicional de identidad omitió el grant contractual del invitado carrier. Se conserva el intento, se documenta la precondición y se mide el par sin grant/con grant. No se considera un defecto del producto.
4. No hubo un Actions nuevo: el workflow V2 se dispara por pull_request. Los resultados aquí son ejecución local y alojada, no CI atribuido a este push.

## Entrega a Axel y QA

Actualizar desde origin/codex/v2-amazon-contracts. Axel puede conectar MCP a los servicios ya desplegados; la evidencia no certifica la UX del cliente ni Alexa real. QA debe partir del SHA de producto 29c385f o del commit posterior con el mismo runtime/migraciones, regenerar el harness nuevo y revisar R01/R02 y los pendientes por fila. Mantener F-02 parcial hasta medir su semántica restante. No usar el corte alojado de 23/26 migraciones como estado actual.

Logs y respaldos privados: salida/uml-bd-api-d3a80eb-20261009 del operador. Se publican matrices y resúmenes sin tokens, contraseñas, claves ni dumps. El siguiente prompt está en [PROMPT_QA.md](./PROMPT_QA.md).
