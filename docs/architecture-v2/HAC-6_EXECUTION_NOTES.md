# HAC-6: Migración de Idempotencia y Transición DRAFT -> PENDING

- **Ticket:** HAC-6
- **Responsable:** Cristhian Chujutalli (BE-2)
- **Rama:** `feat/be2-hac-6-draft-idempotency`
- **Sprint:** Sprint 1 (Cycle 1)

## Alcance Técnico
1. Aplicación local de la migración de idempotencia DDL:
   `supabase/migrations/20260918120000_c_draft_creation_idempotency.sql`
2. Verificación de las 13 aserciones en pgTAP:
   `supabase/tests/08_draft_creation_idempotency.test.sql`
3. Implementación del caso de uso de transición formal `DRAFT` -> `PENDING` en `src/server/services/freight-requests/`.
4. Mantenimiento estricto del invariant: `pnpm typecheck` limpio y RLS activo.
