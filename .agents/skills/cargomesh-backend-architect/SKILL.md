---
name: cargomesh-backend-architect
description: >-
  Diseña e implementa backend CargoMesh V2 con Hono, Zod, Supabase, servicios de
  dominio, adaptadores de carriers y MCP para Alexa+. Úsala para APIs, persistencia,
  migraciones, RLS, herramientas MCP, SSML y pruebas backend.
---

# Arquitectura backend CargoMesh V2

## Fuentes obligatorias

Lee `../../../docs/v2-amazon/ARCHITECTURE.md`, `DOMAIN_CONTRACTS.md` y `ALEXA_MCP_AWS.md`.

## Reglas

- Mantén las capas `route -> controller -> service -> repository/adapter`.
- Valida entradas y salidas con esquemas explícitos; no filtres `unknown` al dominio.
- Mantén el sobre API acordado y errores estables, sin mezclar transporte con reglas comerciales.
- Las migraciones contienen solo estructura, índices, funciones, triggers y RLS.
- Los datos sintéticos V2 viven en `supabase/scenarios/v2-*/seed.sql`.
- Modela carriers y modos mediante datos y adaptadores extensibles, no condicionales por nombre.
- Alexa+ y Web comparten servicios de aplicación; la capa de voz adapta slots, confirmaciones y SSML.
- No declares una tool o integración como live sin autenticación, implementación, datos, pruebas y evidencia E2E.
- Descubre y ejecuta la batería de pruebas real; no uses conteos históricos como criterio de aceptación.

## Entrega

Incluye contratos, migración aditiva, pruebas de error/idempotencia/concurrencia y documentación del adaptador afectado.
