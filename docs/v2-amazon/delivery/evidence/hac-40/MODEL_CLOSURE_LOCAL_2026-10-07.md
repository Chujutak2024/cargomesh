# HAC-40 — evidencia local de los tres huecos del modelo

Fecha: 7-oct-2026. Rama registrada `codex/v2-full-backend`; base exacta `fe12d41e474c2c12d9dcd8e77047a0f2b7f0bd66`; destino `codex/v2-amazon-contracts`. El commit de entrega fija este corte. Dos migraciones aditivas de producción, sin fixtures en migraciones. [Contrato y rutas consumibles](../../HAC40_MODEL_CLOSURE_API.md).

## Resultado local final

| Gate | Resultado | Evidencia reproducible |
|---|---|---|
| Reconstrucción limpia | 22/22 migraciones, historia exacta | Supabase CLI 2.117.0, banco desechable `supabase_db_hac40-model-closure-replay`, puerto local 64322; migraciones copiadas desde cadena nativa |
| Drift public/private | 0: `No schema changes found` | `supabase db diff --local --schema public,private` contra el mismo corte de migraciones |
| pgTAP V2 completo | 932/932, 26 archivos | Perfil `v2` en `supabase-v2/test-profiles.json`; scenario `v2-road-baseline` explícito, `local_only=1` |
| Test 32 cardinalidades/modelo | 61/61 dentro del perfil | Socios, incidente-condición, alternativas, replan, huellas y F-02/F-05; authenticated antes de verificación diferida |
| HTTP con Auth real local | 37/37 | `test:hac40:model-closure-http`, usuarios sintéticos A/B; fixture limpiado por IDs y sesiones cerradas |
| Regresión de aplicación | 286/286 | `pnpm --dir cargomesh test:release`, incluye frontera RoutePlanner |
| Tipos y arquitectura | PASS | Tipos regenerados desde esquema local con nulabilidad explícita de RPC conservada; 157 módulos, 23 entradas cliente |
| Build de producción | PASS | `pnpm --dir cargomesh release:verify` |
| UML/DER | 57 clases / 397 atributos / 93 relaciones, generador PASS | `check-v2-full-model.py`, `build-v2-full-der.py --check`; fuente UML intacta |

Salidas locales fuera del commit: `tmp/model-closure-evidence/{migration-history,pgtap,diff}.log`, `tmp/model-closure-http-results.json`, `tmp/model-closure-release-verify.log`. El runner temporal utilizó puertos exclusivos; el primer intento detectó 61322 ocupado por una referencia local y se cambió a 64322 sin resetear esa referencia.

## Qué queda acreditado

- Socio persistido en la asignación canónica y devuelto por GET. Controles de carrier ajeno, acuerdo vencido, versión obsoleta, replay/conflicto y tenant B. Una revisión INACTIVE del acuerdo bloquea la emisión de oferta y revierte sus filas; después de reactivar el mismo socio, el control positivo crea una única oferta. No se concede capacidad ni cobertura por el socio.
- Puente incidente-condición con RLS/acceso directo revocado, comandos y lectura autorizada. Reemplazo inválido conserva asociaciones/versiones previas. Correlación por el servicio ejecutado, corredor y fecha. No cambia reservas ni publica condiciones sin autorización.
- Búsqueda automática de dos itinerarios publicados con comparación determinística, replay y conflictos. Fingerprint cambia con condiciones; la ruta persiste fuentes/versiones de búsqueda y de validación. Replan ante cierre propone el itinerario alternativo y exige selección. Explicación autorizada conserva UNKNOWN y niega disponibilidad actual confirmada.
- Carreras HTTP reales: búsqueda con la misma clave produce un commit `201` y replay `200` idéntico; socio con la misma versión y claves distintas produce `200` + `409`; condiciones con la misma clave producen una mutación y un replay del mismo resultado. Cada comando llega a su COMMIT nativo.
- Contrato de aplicación rechaza scope inyectado, búsquedas fuera de límites, falta de clave, contadores/metadatos inconsistentes, exhaustividad falsa y condición de replan no correlacionada.

## Correcciones durante el gate

Los positivos finales usan el contrato real `ACTIVE/INACTIVE` del catálogo; se retiró un valor `SUSPENDED` inexistente del fixture. El contador de rollback utiliza `read_v2_workflow` autorizado, sin otorgar SELECT adicional a authenticated. La regeneración de tipos conserva overrides de argumentos nullable que pg-meta no infiere; no se alteraron contratos de catálogo para satisfacer el compilador.

No se modificó el harness `scripts/qa/hac44`. Su matriz histórica no se convierte automáticamente a COMPLETO. El banco local desechable se limpia y detiene al finalizar; el banco local de desarrollo conserva el escenario anterior, con las funciones nuevas aplicadas solo para el smoke. No se promete que su historial manual de migraciones sea el historial limpio 22/22.

## Reprueba independiente pendiente

HAC-44 debe observar este SHA y migraciones, comprobar relaciones UML 48/66 y los tres métodos RoutePlanner, actualizar la matriz desde evidencia y contrastar la corrección documental de reservas (relación 89). Incluir restricciones temporales, rechazo por ruta ajena, límites de búsqueda, nuevas FK y permisos; negativos con controles positivos. El cierre documental de F-02 y el del modelo completo requieren su propio veredicto.

Límites: red publicada acotada, sin conectores viales de última milla, optimización de asignaciones/recursos o multistop. Replan propone snapshots, no modifica compromisos. Sin certificación Supabase alojado, providers live ni Alexa+. Faltantes de HAC-41 y conexión de consumidores conservan sus responsables. No se hizo merge, promoción a main, cambio de Vercel ni despliegue. CI se registra por run/SHA en el PR de entrega; las suites locales no se presentan como CI.
