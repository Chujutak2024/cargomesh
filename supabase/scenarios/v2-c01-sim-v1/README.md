# C-01-SIM v1 — escenario preparado

Este escenario V2 es sintético y está pendiente de autorización de rollout. El manifiesto es la fuente de los datos; no copiar IDs generados por pruebas locales al alojado.

- `C01-SIM-v1.json` y `.sha256`: identidades existentes,23operaciones de preparación y cuatro plantillas posteriores al booking.
- `seed.sql`: activación protegida/transaccional/idempotente. No crea pedidos ni reservas, no habilita autoConfirm y no modifica historial.
- `verify-local.py`: crea y elimina una base local propia, valida schemas, activa dos veces y verifica un flujo nativo. Nunca apunta al alojado.
- `validate-manifest.cjs` y `verify-flow.sql`: validación real y caso focal.

Reproducir desde la raíz del repositorio con Docker y la base Supabase local ya inicializada:

```powershell
python supabase/scenarios/v2-c01-sim-v1/verify-local.py --local-only --container supabase_db_hac45-carrier-local --output C:/ruta/privada/c01-evidencia
```

La política usa perfiles exactos del fixture de costos. Con recojo08:00 y entrega14:00PET del2nov, el importe local calculado es USD361.20 por el tiempo de espera, no USD310.80 fijo. Dos camiones/dos conductores, una oferta/unbooking/dosreservas, PLANNED. Si el horario cambia, recalcular.

La activación alojada requiere aprobación expresa, DDL previas, actores/grants vigentes y revisión del SQL/hash. Los metacomandos del seed requieren psql; no ejecutarlo sin guards mediante una API SQL. La prueba local no acredita login, UI de Vercel ni Nova por voz. Ver la documentación de delivery C01_SIM_V1_PREPARATION_2026_10_21.md.

`activate-reviewed.py` ofrece PREVIEW por defecto sin red; --apply exige aprobación humana registrada, hash esperado y reconocimiento del mandato Carrier de emisión, sin autoConfirm. No ejecutado en el alojado durante la preparación.
