# HAC-50 — Contrato operativo Carrier para coordinación con Cliente

15 de octubre de 2026. Rama existente `codex/unified-workspaces-demo-boundary`, HEAD publicado `cbb10ff1c23b6e44376378b9843cc5e602742e36`. Incremento local, sin push, merge, despliegue, seeds, nuevas migraciones ni grants.

## Avance consolidado

| Área | Implementado | Pendiente |
| --- | --- | --- |
| Vehículos | Contexto autorizado, directorio, alta/revisión y disponibilidad | Datos no registrados, edición de combinaciones/reposicionamiento y completar catálogo |
| Conductores y agenda | Alta/revisión, ventanas, calendarios, mantenimiento y asignaciones | Integración completa en selección/factibilidad de planes |
| Sedes | Política versionada, horarios IANA, muelles/recursos, actividades, equipos, cupos, bloqueos y citas; probado en DB local | Activar migración de sedes en el proyecto correcto; vínculo con discovery/booking |
| Comercial | Detalle de oportunidad, respuesta, oferta, retiro/reemplazo; Cliente actualiza ofertas/bookings | Activar proyección booking→oferta y resource binding→tramo; sesión Cliente para E2E visual |
| Orders / pipeline | Una orden por booking y una tarjeta derivada por oportunidad, sobre datos persistidos | Activación de vínculos remotos; tareas editables/CRM y notificaciones |
| Nuevo contrato operativo | Composición de comprobaciones explícitas de vehículos, conductores y sede en una lectura Carrier | Integración de C3 desde un caso de uso autorizado de Cliente; no es factibilidad completa |

Front reencendido en http://127.0.0.1:8080/ desde el mismo checkout. La cuenta del conector Supabase sigue sin acceso a `yhimeajpzicjbxpbzsyh`; la autorización comercial previa sigue registrada, pero la migración no se aplicó. No cambiar la app a otro proyecto para sortearlo.

## Superficie nueva

`POST /api/v2/carrier-portal/carriers/:carrierId/operational-assessments`

Es una **consulta sin escrituras**. Usa la identidad Carrier y la política de origen/caché existentes. No requiere Idempotency-Key porque no crea ni reserva recursos. No es una API Cliente ni habilita membresías nuevas.

```json
{
  "schemaVersion": "2.0",
  "serviceId": "<servicio autorizado>",
  "resources": [
    {"kind": "asset", "resourceId": "<vehículo>", "window": {"startsAt": "<ISO con offset>", "endsAt": "<ISO con offset>"}},
    {"kind": "driver", "resourceId": "<conductor>", "window": {"startsAt": "<ISO con offset>", "endsAt": "<ISO con offset>"}}
  ],
  "depots": [
    {"depotId": "<sede>", "resourceCode": "DOCK_1", "activity": "LOAD", "equipmentType": "BOX_TRUCK", "window": {"startsAt": "<ISO con offset>", "endsAt": "<ISO con offset>"}, "units": 1}
  ]
}
```

Los placeholders son documentación, no un payload ejecutable ni datos para seed.

Cada recurso/actividad conserva su propia ventana. Un muelle de carga de una hora no se comprueba como si quedara ocupado durante todo el viaje. Se admite entre uno y ocho requisitos, máximo 14 días por ventana. No se repite un recurso físico ni el mismo recurso de sede; las demandas múltiples requieren un caso de planificación conjunto y no se suman a partir de comprobaciones independientes.

Las colecciones necesarias de flota se leen una vez por batch, incluso con varios vehículos/conductores. Continúan paginadas y acotadas; una lectura parcial conserva incertidumbre. Las sedes reutilizan el RPC nativo de disponibilidad, sin recrear horarios, ocupación ni reservas en TypeScript.

## Respuesta y garantías

Contrato: `cargomesh/src/shared/schemas/v2/operational-assessment.ts`.
Caso de uso: `cargomesh/src/server/modules/fleet/application/operational-assessment-service.ts`.

Devuelve `carrierId`, `serviceId`, `scope: EXPLICIT_OPERATIONAL_REQUIREMENTS_ONLY`, estado compuesto y comprobaciones con `kind`, `referenceId`, `resourceCode`, ventana, motivos, procedencia y versiones disponibles de recurso/política. Incluye `startedAt` y `completedAt`.

Un conflicto conocido domina la incertidumbre. Una sede sin migración devuelve `unknown` con `DEPOT_OPERATIONS_NOT_INSTALLED`. Errores de autorización o de infraestructura no se ocultan como disponibilidad desconocida. Respuestas incompatibles o con ID/servicio/ventana distintos fallan con `502 INVALID_ASSESSMENT_RESPONSE`.

La procedencia `SIMULATED` permanece visible; `ESTIMATED`, `STALE`, `UNKNOWN` o una política sin versión no permiten mejorar una respuesta a elegibilidad confirmada. No devuelve nombre/licencia del conductor, agenda completa, credenciales ni datos del pedido Cliente.

Límites explícitos:

- `consistency: NON_ATOMIC_READ`.
- `coverageEvaluated: false`.
- `cargoCompatibilityEvaluated: false`.
- `planEligibilityEvaluated: false`.
- `capacityReserved: false`.
- `requiresCommitRevalidation: true`.

`eligible` significa únicamente que los requisitos explícitamente consultados superaron sus comprobaciones. No certifica requisitos omitidos, dimensiones, licencias/clases específicas del viaje, preferencias, cobertura, rutas, costos, oferta ni booking. La evaluación específica de habilitaciones del conductor continúa en el caso de asignación nativo; no se inventan requisitos a partir del país.

Las versiones de vehículo/política no representan una versión global de disponibilidad: calendario, reservas, citas o mantenimiento pueden cambiar sin modificar esa versión. Nunca utilizarlas solas para confirmar capacidad. El comando de compromiso debe revalidar fuentes y conflictos atómicamente; las RPC nativas de reserva/confirmación conservan esa responsabilidad.

## Handoff para Jean

1. Reutilizar los DTOs y reglas existentes en C3; no duplicar tablas de sedes, muelles, horarios ni calendarios.
2. Cliente no llama este endpoint privado ni fabrica un actor Carrier. Necesita un caso de uso autorizado de discovery con repositorio/proyección expresamente permitidos para la organización, sin ampliar grants por conveniencia.
3. El plan determina los requisitos físicos aplicables: recurso/sede realmente utilizados, actividad, cupos y ventanas derivadas de ruta/duración. No exigir muelle propio para recogida directa ni inferir cobertura por sede.
4. Combinar estas decisiones con cobertura, socios, carga/dimensiones, equipo, habilitaciones y restricciones del viaje. No promover el estado de esta consulta a estado del plan completo.
5. Revalidar ante cambio de versión/fecha/ruta y al comprometer capacidad. Ni refresh, ni aceptación de oportunidad ni movimiento de pipeline reservan recursos.
6. El contrato C6 de pedido minimizado/versionado y la corrección de paridad TS/SQL de socios siguen en el corte coordinado de Jean. Este incremento no los modifica.

## Verificación de este incremento

- 54/54 pruebas Node: 12 nuevas del agregador y regresiones de disponibilidad, sedes, asignaciones y crew.
- TypeScript sin emisión: PASS.
- Arquitectura: PASS, 393 módulos y 107 entradas cliente.
- 9/9 HTTP con sesión privada en memoria del Carrier sintético existente: resultado correlacionado, vehículo fuera de servicio, sin nombre de conductor, sede sin migración como unknown, demandas repetidas/inyección rechazadas, Carrier ajeno, origen externo y anon denegados.
- No se escribieron cotizaciones, reservas, citas ni datos de catálogo durante HTTP. No hay cambios SQL que requieran un nuevo gate de migración en este corte.
- Evidencia: `UNIT_RESULTS.txt` y `HTTP_RESULTS.json`; no contienen credenciales.
- No se añadió UI ni se certificó la inspección visual pendiente de los incrementos anteriores.

## Siguiente paso

Activar las migraciones pendientes al conectar el proyecto autorizado, integrar C3/C6 con Jean y probar el recorrido Cliente→oportunidad→oferta→booking→asignaciones/citas. Fechas alternativas, recuperación/custodia, tareas editables, CRM y orquestación Three.js siguen separados.

Reproducción desde `cargomesh/`: `pnpm test:carrier-operations`, `node node_modules/typescript/bin/tsc --noEmit --incremental false`, `node scripts/check-architecture.mjs`. Instalador de staging de una sola pasada: no volver a ejecutarlo.
