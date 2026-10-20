# Punto 2 — Pedido y oportunidad Carrier

Implementado en local, en codex/unified-workspaces-demo-boundary. Sin commit, push ni despliegue.

## Resultado

Requests presenta el pedido autorizado con código, versión, referencia Cliente, origen/destino por ciudad, carga, equipo y ventanas. Permite aceptar para revisión o rechazar mediante permisos existentes; la respuesta no modifica el pedido Cliente ni reserva recursos. Versiones obsoletas se rechazan y contactos/direcciones exactas permanecen retenidos en esta etapa.

Cuatro casos sintéticos persistidos mediante sesiones HTTP nativas en la base local marcada: pendiente, aceptado para revisión, rechazado y candidato de ensayo de versión. El ensayo obsoleto se ejecutó en una transacción revertida: no se habilitó la edición de pedidos PENDING. Planes con capacidad/cobertura desconocida conservan su advertencia. La creación de invitaciones usó comandos explícitos existentes; todavía no hay descubrimiento automático al enviar Cliente.

## Archivos principales del checkout activo

- supabase-v2/supabase/migrations/20261019190034_hac50_carrier_request_projection.sql
- supabase-v2/migration-manifest.json y test-profiles.json
- cargomesh/src/features/carrier-juan/opportunity-request-brief.ts y su prueba
- cargomesh/src/features/carrier-juan/opportunity-model.ts
- cargomesh/src/features/carrier-juan/connected-opportunities.tsx
- cargomesh/package.json: nueva prueba incluida en suite comercial
- supabase/scenarios/v2-client-carrier-access/seed.sql: operador propio OPERATOR
- supabase/scenarios/v2-client-carrier-requests/seed.sql
- supabase/tests/38_v2_hac50_request_projection.test.sql

No se reemplazaron private.workflow_record ni el schema compartido del pedido. Migración aplicada únicamente en hac50_scenario_fleet80_global_v1, con marcador LOCAL_ONLY:v2-carrier-fleet-80. El corredor sintético es simulado, no Google Routes.

## Evidencia disponible en esta carpeta

- request-native-final-run.json: 25 comprobaciones HTTP PASS.
- request-version-tap.txt: 4 comprobaciones de versión PASS, con rollback.
- projection-privacy-pgtap.txt: 14 pruebas de privacidad/ACL PASS.
- Tipos, arquitectura, manifiesto y 62 pruebas comerciales PASS.
- requests-detail-local.png: inspección visual del agente; no equivale a validación humana.

No se ejecutó build completo ni replay de migraciones sobre base nueva. La preferencia posterior del usuario limita nuevas pruebas a riesgos importantes/fallos; revisión visual/de uso queda en el usuario.

## Límites y continuidad

No hay ofertas, bookings, holds ni ejecuciones nuevas en este corte. Hosted y Vercel no cambiaron; acceso administrativo alojado sigue pendiente. Siguiente: evaluación/estimación y oferta autorizada, coordinadas con los dueños Cliente. La carga mixta por líneas y requisitos independientes requiere ampliar el contrato; varios recursos por plan ya están contemplados, sin certificar todavía el flujo completo.

Por instrucción posterior del usuario, terminar primero Cliente–Carrier y retomar después el detalle FTL. La ampliación quedó documentada en [líneas, reparto, entregas y coordinación](./HAC50_CARGO_LINES_ALLOCATION_DELIVERIES_2026-10-19.md), sin código ni pruebas nuevas.
