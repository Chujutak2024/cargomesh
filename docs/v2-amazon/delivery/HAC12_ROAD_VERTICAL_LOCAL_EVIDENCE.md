# HAC-12 — evidencia local del vertical ROAD V2

Estado: **implementación local verificada, pendiente de revisión independiente e integración**, no desplegada ni aceptada. Rama de trabajo `feat/be2-v2-road-serviceability`; PR objetivo `feat/cycle-2-integration`, que ya recibió HAC-29 (#90). El proyecto Supabase V2 alojado no fue modificado.

**Revisión adicional de cobertura (28 sep):** el dominio verifica el área de recojo solo en `pickupWindow` y la de entrega solo en `deliveryWindow`; conserva lane/capacidad sobre la operación completa. Una exclusión que empieza durante la ventana pertinente impide `eligible`, mientras que una exclusión posterior a la ventana de recojo no bloquea ese recojo. Pruebas focalizadas de dominio/aplicación: 26/26 PASS. El 29 sep se repitieron el gate y el smoke con ambas migraciones HAC-12, como se detalla abajo.

## Corte implementado

- Hono/Next: `GET /api/v2/intake/options`, `POST /api/v2/freight/requests`, `GET /api/v2/freight/requests/:id` y `GET /api/v2/freight/requests/:id/serviceability`.
- `intake/options` entrega cinco grupos tipados: `facilities` del tenant, las ocho `cargoCategories` con guía, y vocabularios versionados `equipmentOptions`, `packagingOptions`, `requirementOptions`. Embalaje lleva `CAPTURE_ONLY`; temperatura y sello llevan `RESOURCE_EVIDENCE`; frágil y peligroso llevan `REQUIRES_REVIEW`. Los selectores no certifican capacidad ni permisos del carrier.
- DTO anidado `schemaVersion: "2.0"`; persistencia atómica mediante una RPC `SECURITY INVOKER`, recibo/hash de idempotencia y snapshots canónicos de sedes. El servidor resuelve el tenant desde la sesión. Sede ajena → `403`; ID inexistente → `400`; lectura de otra organización → `404`.
- Elegibilidad ROAD de solo lectura: áreas, lane dirigida, categoría, equipo, peso/volumen, certificaciones y temperatura **del mismo recurso**, calendario, reservas, mantenimiento y reposicionamiento. `TEMP_CONTROLLED` sin rango térmico y los requisitos `FRAGILE`/`HAZARDOUS` quedan `unknown`, incluso si el recurso publica una etiqueta con ese código. Sin ruta inferida, precio ni booking. Se recorren todos los servicios ROAD activos; falta evidencia → `unknown`.
- Migración estructural aditiva en `supabase-v2/supabase/migrations/`; datos de demo exclusivamente en `supabase/scenarios/v2-hac12-road-capacity/`, encima del baseline sintético HAC-29. Una disponibilidad `SIMULATED` se presenta como tal, nunca como live.
- Corrección de elegibilidad temporal: `eligible` exige duración de lane `VERIFIED`/`SIMULATED`, calendario vigente y evidencia de que **ese mismo recurso** está listo en el área de recojo. La llegada se comprueba desde el fin de la ventana de recojo hasta el fin de entrega. La falta de duración o ubicación queda `TEMPORAL_FEASIBILITY_UNKNOWN`; una llegada posterior queda `DELIVERY_WINDOW_UNREACHABLE`. El escenario local aporta una duración y punto de partida simulados mediante una migración aditiva; ninguna fila heredada recibe esos datos por defecto.
- Cruce de país o lane marcada para revisión queda `BORDER_DOCS_UNKNOWN`, aunque la bandera histórica de revisión sea `false`. Una prohibición documentada en la lane queda `BORDER_CROSSING_PROHIBITED` e `ineligible`. La respuesta no afirma autorización fronteriza. Una clase de servicio ausente produce error de contrato; no se reemplaza por `FTL`.

## Verificación realizada

- TypeScript, chequeo de arquitectura y build Next.js de producción: PASS.
- Pruebas unitarias de DTO, intake, solicitud y elegibilidad: 34/34 PASS en el corte de cinco grupos; `tsc --noEmit --incremental false`: PASS. Las nuevas pruebas cubren códigos/estados de los cinco grupos, requisitos pendientes de revisión y temperatura/sello en el mismo recurso.
- Regresiones existentes: Hono 42/42 y MCP 75/75 PASS. Estas suites heredadas no sustituyen el smoke HTTP V2.
- Reset local limpio de HAC-29 PR #90 (`25b2b46`) más delta HAC-12 (`7de491c`): las tres migraciones aplicaron en orden; ocho categorías y cero organizaciones/solicitudes/Auth antes de sembrar el escenario. Los escenarios HAC-29 y HAC-12 se sembraron y verificaron en ese orden.
- pgTAP local combinado: 90/90 en cinco archivos; HAC-12 aporta 17/17, incluyendo creación/replay/conflicto, RLS/tenant, sedes ajenas, USD y un fallo temporal **después del INSERT** que deja cero borradores/recibos. El trigger de fallo existe solo dentro de la transacción de prueba.
- Gate local completo sobre el checkout combinado HAC-29/HAC-12 con los fixes de puertos `96a8d1d` y `11d6fb0`: `manifest` PASS, `v2` PASS (90/90 pgTAP, ausencia V1 con 9/9 controles positivos, drift del baseline y cleanup) y `v1` PASS (183/183 pgTAP). Bases de puertos `61300`/`62300`; evidencia en `%TEMP%\hac29-hac12-ports-20260928`. El checkout de gate `8ca052d` incluye manifiesto/perfil HAC-12, pero todavía no la última ampliación de cinco grupos; esa ampliación pasó sus pruebas TypeScript/unitarias por separado.
- `supabase db advisors --local` sobre la cadena combinada: seguridad y rendimiento sin hallazgos `warn`/`error`.
- Smoke HTTP local contra Next/Hono + Auth/REST Supabase sobre ese reset: PASS para autenticación, ocho categorías, POST→GET, replay `200`, conflicto `409`, sede ajena `403`, inexistente `400`, lectura cruzada `404`, `expectedDraftVersion` obsoleta `409`, 1 candidato elegible, 1 `unknown` y Piura con cero. El script falla si la URL no es loopback y borra por ID los borradores que crea.
- **Gate combinado repetido (29 sep):** checkout aislado de `feat/cycle-2-integration` + HAC-12, con los dos conflictos `add/add` de manifiesto/perfil resueltos solo para validación. `manifest` PASS; `v2` PASS con las cuatro migraciones V2 aplicadas desde cero (dos HAC-29 y dos HAC-12), 98/98 pgTAP en cinco archivos, controles de ausencia V1 9/9, comparación de baseline y cleanup con cero filas sintéticas. Evidencia local: `%TEMP%\hac12-gate-resume-20260928`. Puertos de replay `61300`/`62300`.
- Tras el cleanup del gate, los escenarios sintéticos HAC-29 y HAC-12 se sembraron y verificaron de nuevo. Smoke HTTP autenticado contra Next/Hono + Supabase local: PASS para cinco grupos, POST→GET, replay/conflicto, tenant/sedes, `eligible`, `unknown`, cero candidatos y `expectedDraftVersion` obsoleta. El primer intento no encontró el fixture HAC-29 en la rama HAC-12 aislada; `HAC12_FIXTURE_ROOT` apuntó al checkout combinado y el segundo intento pasó. El script limpió los borradores creados.
- `supabase db advisors --local --type all --level warn --fail-on warn`: sin hallazgos. `pnpm test:release`: 410/410 PASS en 18 comandos de prueba; `pnpm typecheck`, `pnpm check:architecture` y `pnpm build`: PASS sobre la rama HAC-12.
- Tras el smoke, otro `supabase db reset --local` aplicó de nuevo las cuatro migraciones V2; los conteos locales finales son 0 organizaciones, 0 usuarios Auth y 0 solicitudes.
- Preflight remoto de solo lectura del 29 sep: el listado disponible no expuso el proyecto V2. **Corrección 1 oct:** la consulta directa por ref `yhimeajpzicjbxpbzsyh` confirma `cargomesh-v2`, separado de V1 y `ACTIVE_HEALTHY`. Migraciones y tablas (`public`/`private`) devolvieron listas vacías. El esquema remoto sigue pendiente; la ausencia en un listado no acredita ausencia del proyecto. No se aplicaron migraciones hospedadas.

## Pendientes antes de In Review/Done

1. Integrar en HAC-16 los dos conflictos `add/add` de manifiesto/perfil, cuya resolución local ya pasó el gate, y conservar la evidencia del checkout combinado. Véanse [FL-03](./friction-logs/FL-03.md) y [FL-05](./friction-logs/FL-05.md).
2. R-01 a R-05 recibieron reprueba independiente PASS en 605435b. Obtener reprueba de R-06/R-07/R-08/R-09 de HAC-12 y reejecutar los checks pertinentes tras cualquier corrección. No mezclar directo a la rama base ni a `main`.
3. Conectar el mismo servicio de aplicación a HAC-11 (MCP) y las vistas HAC-14/15, y pasar QA HAC-13 sobre el corte integrado.
4. HAC-27 publica los fixtures corregidos y debe obtener confirmación de consumo de HAC-14/15: el catálogo físico actual acredita `FTL` y **ningún canal V2 publicado**. La API devuelve `FTL` y `responseChannels: []`; no inventa capacidades comerciales.
5. Verificar sobre el corte integrado el consumo de los cinco grupos de HAC-14 (`facilityId`, códigos de categoría/equipo/embalaje/requisitos), los errores visibles y el fixture solo explícito. Luis reportó esa implementación en su rama, pero aún falta el recorrido conjunto con HAC-12; seguimiento en [FL-04](./friction-logs/FL-04.md).
6. Hacer el preflight y la aplicación controlada de las migraciones solo al proyecto hospedado `cargomesh-v2` separado cuando su identidad y acceso estén confirmados y exista aprobación de ejecución. Registrar tablas/RLS/conteos antes y después; no usar el proyecto V1 `cargomesh`.

Límite funcional: `packaging` se valida como dato de captura y se persiste, pero el evaluador ROAD aún no verifica si el recurso puede manipular ese embalaje. Por ello, un `eligible` en este corte describe los filtros ROAD implementados; no es una confirmación de compatibilidad de embalaje, oferta, reserva ni autorización de booking. Registrar la regla/evidencia de embalaje antes de afirmar esa capacidad como verificada.

Este corte no persiste las 57 clases UML ni implementa ofertas, reservas de booking, otros modos o Alexa+ live. Reutiliza tablas V1 seleccionadas como estructura, no sus carriers ni su flujo WebMCP.

## Correcciones de revision independiente - 1 oct 2026

Jean Paul reviso PR #91 en `0a6406f` y registro **Requiere cambios**:
[revision con reproducciones R-01 a R-05](https://linear.app/hackatonteamcargomesh/document/hac-12-revision-tecnica-independiente-del-pr-91-0a6406f-1-oct-83ee0f4cf226).
Los cambios siguientes pertenecen al responsable HAC-12 y necesitan reprueba independiente.

| Hallazgo | Correccion implementada | Verificacion |
| --- | --- | --- |
| R-01: UPDATE directo modifica snapshot sin version | Migracion aditiva bloquea todo UPDATE de una solicitud V2, incluida la eliminacion del marcador o un aumento manual de version, con `409 V2_DRAFT_MUTATION_UNSUPPORTED`. Sprint 2 expone creacion/lectura; no hay edicion V2 legitimada por una RPC versionada. La futura edicion debe reemplazar esta guarda mediante un contrato canonico con version esperada. | pgTAP bajo `authenticated` y smoke Data API PASS; snapshot/version permanecen intactos. |
| R-02: LTL elegible sin cupo/consolidacion | Capacidad fisica compatible conserva `unknown` con `LTL_CAPACITY_AND_CONSOLIDATION_UNVERIFIED`. Ni un camion ni un pool generico prueban consolidacion. Una imposibilidad fisica sigue `ineligible`. No se anuncia LTL operativo. | Dominio, DTO y smoke HTTP PASS; volver a FTL restaura el control positivo. |
| R-03: cantidad/totales inconsistentes | Zod y RPC suman `quantity * weightPerUnitKg/volumePerUnitM3`. Tolerancia absoluta `0.000001 kg/m3` solo para redondeo. El evaluador toma el mayor entre el total declarado y el calculado; la tolerancia no rebaja el filtro de capacidad. | Zod, multiples grupos, limite fisico, RPC y HTTP PASS; error no crea recibo. |
| R-04: Bearer no se propaga | Authorization Bearer tiene prioridad sobre cookies; usuario validado por Auth y membresia activa. El contexto asincrono propaga el token del usuario a las consultas/RPC. Un header invalido no cae a cookies. | HTTP PASS para POST/GET/options/serviceability con Bearer sin cookie, prioridad frente a cookie de otro tenant, token/header invalido y membresia INACTIVE (403 en los cuatro endpoints). |
| R-05: lat/lng manuales descartados | La RPC conserva ambos valores; par incompleto o fuera de rango se rechaza. `facilityId` mantiene la prioridad de la sede de BD. `facilityId: null` identifica una ubicacion manual no verificada; un pin no aporta geometria de ruta ni cobertura confirmada. | DTO/aplicacion, round-trip RPC/HTTP, par invalido, precedencia de sede canonica y routePreview null PASS. |

Nueva migracion: `supabase-v2/supabase/migrations/20261001201251_hac12_review_guards.sql`.
Las dos migraciones HAC-12 anteriores permanecen intactas; la cadena combinada contiene cinco migraciones.
La suite `pnpm test:hac12` ejecuta los cinco archivos de pruebas V2 y se incluye ahora en `pnpm test:release`.

Verificacion del corte corregido: 47/47 pruebas HAC-12 y 457/457 pruebas release PASS (19 comandos; incluye ahora los cinco archivos V2). TypeScript, arquitectura y build PASS.
El manifiesto combinado verifica inventario, dependencias y hashes PASS. Sus mensajes generales de tareas bloqueadas no acreditan ni sustituyen el gate del producto.
**Gate del delta nuevo (1 oct):** `gate.py v2` PASS sobre el checkout combinado basado en `f2a8e3e` mas HAC-12 y estas correcciones. Las cinco migraciones aplicaron desde cero; pgTAP 116/116 en cinco archivos, de las cuales HAC-12 aporta 43/43. Ausencia V1 con controles positivos 9/9, drift del baseline y cleanup PASS. Puertos de replay `61300`/`62300`. Smoke HTTP Cookie/Bearer/Data API PASS sobre los escenarios sinteticos resembrados; advisors locales sin hallazgos warn/error. Evidencia sin credenciales: `%TEMP%\hac12-review-fixes-20261001` (`v2/v2-pgtap.log`, `http-smoke.log`, `release.log`, `advisors.log`, `final-reset.log` y `final-counts.log`). Un reset final vuelve a dejar 0 organizaciones, 0 usuarios Auth y 0 solicitudes. Docker se recupero creando una carpeta IPC limpia y preservando la anterior; vease [FL-06](./friction-logs/FL-06.md).

El PR permanece borrador pendiente de reprueba independiente y gate de integracion; la validacion local del delta SQL/HTTP ya paso. HAC-16 conserva la resolucion de los dos conflictos de manifiesto/perfil. No se hizo merge, deploy ni cambios en Supabase hospedado.


## Re-revisión del 2 oct: R-06 / R-07 / R-08 / R-09

Jean Paul confirmó R-01 a R-05 **5/5 PASS** en `605435b`; esta entrega conserva esas correcciones. Los hallazgos nuevos se corrigieron por el dueño HAC-12; la aceptación independiente sigue pendiente.

| Hallazgo | Corrección | Evidencia del nuevo corte |
|---|---|---|
| R-06 alta: INSERT directo con snapshot Piura/sede Lima | Trigger BEFORE INSERT valida DTO, miembro/tenant, marcador/versión, snapshot contra ubicación canónica de sede propia activa y columnas planas. No altera la guarda UPDATE anterior. Legacy sin marcadores mantiene su contrato. | Ocho INSERT alterados rechazados con PT400; copia canónica válida positiva. HTTP Data API authenticated rechaza el ataque, GET y conteos siguen intactos (2 candidatos); cero borrador/recibo del intento inválido. |
| R-07 media: RPC guarda units sin dimensiones/indivisible | pg_jsonschema valida contrato completo anidado; SQL añade ventanas/totales/coordenadas/rango térmico. No admite formas incompletas que GET no pueda leer. | 25 variaciones inválidas RPC → PT400 sin recibo; mismo Idempotency-Key corregido crea una fila. RPC válido y posterior GET → 200; totales con precisión tolerada conservan control positivo. |
| R-08 baja: [{}] en available_windows | CHECK de cada ventana: startsAt/endsAt ISO con offset, objetos estrictos y fin posterior al inicio. [] permitido para agenda incompleta. | Cuatro controles malformados fallan 23514; [] y ventana válida pasan. |
| R-09 media: reservas activas solapadas | EXCLUDE GiST por capacity_calendar_id + tstzrange [inicio,fin), parcial HELD/CONFIRMED. RELEASED no bloquea; cada fuente tiene agenda única. | HELD/CONFIRMED solapados y reactivación fallan 23P01; adyacentes/liberados pasan. Dos transacciones simultáneas: una COMMIT, otra 23P01; una sola fila. |

Migración nueva aditiva `20261002073853_hac12_insert_contract_and_reservation_guards.sql`; **seis migraciones** en el checkout combinado (dos HAC-29 y cuatro HAC-12). Hash/dependencia registrados en migration-manifest. Sin seeds en producción; test 13 crea su fixture únicamente dentro de BEGIN/ROLLBACK, independiente del rollback del archivo 12.

Verificación descubierta/ejecutada:

- `pnpm test:release`: **458/458**, 19 comandos; `test:hac12`: **48/48** (cinco archivos).
- `pnpm typecheck`, `pnpm check:architecture` (237 módulos / 25 entradas cliente) y `pnpm build`: PASS.
- `python supabase-v2/gate.py v2 --evidence-dir <evidencia>/v2-final --v1-replay-port-base 61300 --baseline-replay-port-base 62300`: manifest PASS, **170/170 pgTAP en seis archivos**; test 13 aporta 54/54, ausencia V1 9/9 con controles positivos, baseline sin drift, cleanup PASS. Checkout combinado basado en `f2a8e3e`; los dos conflictos del PR no se han resuelto en la rama de integración.
- HTTP real Next/Hono + Auth/Data API local: Cookie/Bearer, aislamiento, UPDATE, INSERT forjado/positivo, RPC incompleta/válida, totales, pines, LTL, POST/GET/replay/conflicto, stale y cero candidatos PASS. Se ejecuta el build de la rama HAC-12; fixtures de HAC-29 se toman del checkout combinado.
- Dos sesiones PostgreSQL concurrentes: no-solape PASS. Advisors locales: sin hallazgos warn/error.
- Ocho JSON de HAC-27 parseados contra los schemas Zod actuales: PASS. Incluyen `FTL`, `responseChannels: []` y literal canónico `v2-clean`; siguen rotulados como fixtures estáticos. Diccionario 57 clases / 397 atributos / 93 relaciones; UML original sin modificar hash.

Logs locales: `%TEMP%/hac12-rereview-20261002` (`v2-final/v2-pgtap.log`, `http-smoke.log`, `reservation-concurrency.log`, `release.log`, `build.log`, `final-reset.log`, `final-counts.log`). Primer gate fallido conservado en `v2/`: el test nuevo dependía indebidamente del fixture de otro archivo revertido; corregido con fixture propio y repetido desde reset limpio. El checkout de validación se respaldó antes de refrescar únicamente los archivos HAC-12; copia de sus cambios previos en `pre-refresh/`.

Pendientes externos/aceptación: reprueba independiente R-06–R-09 y C-01/C-02; fixture RouteCondition por Jean/HAC-13; mcp_account_links por Axel/HAC-11; consumo conjunto HAC-14/15; conflictos/integración HAC-16 y autorización de aplicación al Supabase V2 alojado. La presencia de 19/20 tablas del conjunto UML local y los controles anteriores no certifican todos los atributos ni Alexa+ live. Sin merge ni despliegue por esta entrega.

## Re-revisión posterior a 3cf966f — R-06-E1 / R-10 / R-11

Reparación validada localmente; entrega para reprueba independiente, sin aceptación ni merge implícitos.

- **R-06-E1:** migración aditiva `20261003035802_hac12_receipt_hash_and_service_role_guards.sql`. BEFORE INSERT V2 recalcula SHA-256 del payload canónico y rechaza hashes falsos con PT400/VALIDATION_ERROR antes de consumir fila o clave. Conserva el hash Node existente, normalización binary64, UTF-8 y orden de claves del DTO estricto. Legacy sin los tres marcadores V2 conserva la misma frontera del trigger previo; no se usa ausencia de clave como criterio legacy.
- **R-10:** USAGE mínimo de private para service_role, sin cambiar SECURITY INVOKER ni guardas de tenant. La primera RPC de una conexión nueva en test 14 se ejecuta con service_role y persiste una fila válida.
- **R-11:** activo/calendario de test 13 con sufijo 013, separados del seed 001. Test 13 54/54 sobre baseline solo y 54/54 con escenario de capacidad. No se alteran IDs del seed.
- Tests 12/13 usan hashes del payload correcto; controles de coordenadas manuales y tolerancia decimal incluyen sus modificaciones. Test 14: 21 aserciones, con hash falso sin consumo de clave, POST/RPC legítimo posterior, INSERT coherente y replay, permiso anon y diez hashes golden generados por la función Node real.
- Smoke HTTP autenticado ampliado: INSERT coherente con 64 ceros rechazado, cero recibos para esa clave, POST legítimo 201 y replay 200 con mismo ID. Conserva controles Cookie/Bearer, tenant A/B, mutación de snapshot, DTO, manual pins, capacidad/elegibilidad, LTL, conflictos y lectura.

### Comprobaciones de esta entrega

- Gate V2 desde cero: **PASS**, siete migraciones, siete archivos pgTAP **191/191**, procedencia/hashes/dependencias, baseline histórico equivalente, controles positivos V1 aislados, ausencia de fixtures V1 en V2, escenario y cleanup.
- Tras cleanup: **0 organizaciones, sedes, carriers, miembros y usuarios/identidades Auth** del escenario; ocho categorías de referencia conservadas. Sin datos sintéticos incorporados a migraciones de producción.
- HAC-12 **48/48**, typecheck y arquitectura PASS. Los ocho fixtures HAC-27 parsean contra Zod. RouteCondition PR #95 @07f480e: **11/11** contra artefactos, sin DB.
- HTTP autenticado real **PASS** con la nueva guarda activa. Concurrencia de reservas R-09 no modificada; su carrera en dos sesiones ya fue confirmada por QA sobre 3cf966f.
- Release completo/build no reejecutados en este delta de SQL, pruebas y contratos; los 458/458 previos corresponden a 3cf966f. El smoke usa el build existente de los módulos de aplicación sin cambios TypeScript.
- Evidencia reproducible local en `tmp/HAC12_RECEIPT_REPAIR_2026-10-02/`: `gate-final/v2-pgtap.log`, `gate-final/cleanup-zero-assertion.log`, `test13-with-capacity-seed.log`, `http-smoke.log`. Comando gate: `python supabase-v2/gate.py v2 --evidence-dir <carpeta> --v1-replay-port-base 61300 --baseline-replay-port-base 62300`, usando el checkout combinado existente con metadatos HAC-29/HAC-12 resueltos.

Primer intento detectó siete fallos: seis eran controles manuales que conservaban el hash del payload base y uno era la guarda legacy demasiado estricta. Corregidos y repetidos los siete archivos y el gate completo. Los diez vectores Node/SQL y la RPC service_role pasaron desde el primer intento.

Docker recuperado tras reproducir dockerInference: carpeta IPC preservada y reconstruida con procesos detenidos, motor comprobado; detalle en FL-06. No se modificó Supabase alojado, V1 remoto ni producción.

El candidato HAC-16 previo de seis migraciones sobre 3cf966f queda como evidencia histórica. Debe regenerarse contra el head definitivo con siete migraciones antes de aceptación/integración. Pendientes: reprueba independiente R-06-E1/R-10/R-11 y C-01, confirmación de consumo HAC-11/14/15 y gate HAC-16. Ningún PASS local demuestra MCP/Alexa live.
