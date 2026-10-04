# HAC-40 — evidencia local de workflow, 4 oct 2026

Rama `codex/v2-full-backend`; incremento sobre `057117fa50bf255fd29c3976dc0728c987fee63c`; Draft #99 hacia `feat/cycle-3-integration`. El commit que incorpora este informe fija el corte de código. Sin merge ni aplicación alojada.

| Comprobación | Resultado real |
|---|---|
| Cadena nativa V2 reconstruida de cero | 16 migraciones; incluye `20261004154048_hac40_workflow.sql` |
| Manifest SHA-256 / secuencia | PASS, hash normalizado del workflow `ff3bde176443112fa49528c1230c146b771037ab7c15bd04c7104b6a81e94849` |
| pgTAP del perfil V2 | 21 archivos, 685/685 PASS |
| Regresión sin fixtures V1 en V2 | 9/9 controles positivos de ausencia PASS |
| Replay histórico vs baseline congelado | PASS; comparador excluye los deltas nuevos V2 |
| RouteCondition del escenario | 12/12 PASS; no altera ETA/elegibilidad por el fixture |
| Carreras reales | solicitud, catálogo, flota, crew y workflow PASS |
| Release aplicación | 520/520 PASS; `test:hac40` 51/51 incluido |
| Typecheck / arquitectura / build | PASS; arquitectura 287 módulos, 33 entradas cliente |
| Next/Hono → Supabase local con Bearer real | 14 colecciones/detalles y salidas tipadas; creación/replay/hash conflict/revisión/stale; autorización/confirmación/cancelación con liberación atómica PASS sobre bundle construido |
| UML / DER objetivo | 57/397/93, hash UML original intacto, ambos validadores PASS; ambos certificadores de implementación permanecen false |
| Supabase DB lint | Ejecutado. Cero errores nuevos de funciones workflow; conserva diagnósticos pgTAP y falsos positivos de análisis estático de lectores dinámicos previos. No se presenta como cero avisos globales. |
| Limpieza del escenario local | PASS: identidades, tenants, carriers, sedes/servicios/áreas/lanes sintéticos en cero; ocho categorías estructurales retenidas |

## Reproducción

Supabase CLI fijada `2.117.0`, Docker y stack dedicado `supabase_db_cargomesh-v2-local`. El gate requiere un directorio de evidencia **fuera** del repositorio.

```text
python supabase-v2/gate.py v2 --evidence-dir <directorio-externo> --v1-replay-port-base 61300 --baseline-replay-port-base 62300
pnpm --dir cargomesh typecheck
pnpm --dir cargomesh test:release
pnpm --dir cargomesh check:architecture
pnpm --dir cargomesh build
python scripts/check-v2-full-model.py
python scripts/build-v2-full-der.py --check
```

HTTP: reconstruir/sembrar explícitamente el escenario local autorizado, iniciar Next con las credenciales de ese stack y ejecutar `test:hac40:workflow-http`; exige URLs localhost, password sintético explícito y Python configurado. No acepta Supabase alojado. `hac40_workflow_local_fixture.py` prepara/limpia únicamente sus identificadores; un estado existente bloquea el reintento hasta resolverlo. Finalmente correr la limpieza protegida del gate.

El gate publicado escribe logs/backups locales en `C:/Users/HP/AppData/Local/Temp/cargomesh-HAC40-workflow-published-20261004`; no se publican respaldos ni secretos. Las pruebas HTTP registran solo resultados; datos de prueba son explícitamente sintéticos.

## Defectos encontrados y corregidos antes de publicar

- Solape sin consolidación: el nuevo guard cambiaba el código SQL a PT409; se conservó 23P01 y se repitió la suite de regresión completa.
- Publicación revisada devolvía 201; ahora devuelve 200 y pasó la prueba HTTP.
- Ranking de cotizaciones parciales: se sustituyó por conjuntos de cobertura completa disjunta y se comprobó el caso de dos tramos/dos ofertas frente a una oferta completa.
- Contrato JSON de arrays: evidencia/capacidad se materializan como arrays JSON y se validan con salidas nativas reales.
- Carrier inactivo: invalida elegibilidad y su baja se serializa con servicios, rechazándose si hay reservas activas. Positivos y negativos incluidos en pgTAP.

## Lo que esta evidencia no acredita

No certifica la matriz completa atributo por atributo, esquema/dataset alojado, UI integral, MCP/Alexa live, búsquedas automáticas completas de red/asignaciones ni contratos/llamadas externas de carrier. No acredita packing/estiba tridimensional ni verificación legal gubernamental. Los filtros físicos y declaraciones carrier conservan sus fuentes y límites. [Contrato y pendientes](../../HAC40_WORKFLOW_API.md).
