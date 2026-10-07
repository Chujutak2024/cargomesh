# HAC-40 — operación física LTL compartida

Fecha: 4-oct-2026. Rama `codex/v2-full-backend`; base de implementación `b4f1da4537ed1e0edf54c10aa978c325f45b993b` de `codex/v2-amazon-contracts`. El SHA de entrega queda registrado en el PR y Linear. HAC-40 permanece In Progress.

## Cambio y alcance

Cuatro POST carrier: `consolidations/:id/starts`, `completions`, `cancellations`, `positions`. Prefijo completo `/api/v2/carriers/:carrierId/`. GET conserva el contrato de consolidaciones/ejecuciones/eventos. Inventario real Hono: **204 GET/POST de negocio únicos**, 111 del workflow y 93 previos; health y middleware excluidos.

Migración aditiva nativa `20261004232244_hac40_ltl_shared_operations.sql`, SHA-256 normalizado LF `6c81f7e6963b65b2bac98298fc3ad1c1e81ba598e43610f7d8e604fd9c06acce`. Dependencia: `20261004154048`. La cadena contiene 17 migraciones; las anteriores permanecen intactas. No agrega escenarios sintéticos. Tipos públicos regenerados desde el esquema local conservando nulabilidad RPC previamente revisada.

La ocupación de driver se deriva del viaje; clientes no eligen su clave. GiST impide solapar viajes físicos diferentes; los miembros del mismo viaje comparten ocupación. La jornada planificada suma unión de intervalos y `usedDutySeconds` del snapshot de fuente, no múltiples copias del mismo viaje. Este cálculo no sustituye la actualización de jornada real por una fuente operativa.

Start comprueba reservas/booking, planes vigentes, ventanas completas y crew común. Los comandos coordinan miembros en una transacción y correlacionan eventos físicos con historiales separados por tenant. Cancelar un booking en tránsito conserva los demás miembros. Cancelación previa a la salida también libera capacidad. Replays no incrementan versiones ni repiten eventos. Crew en tránsito e inicio/posición/finalización individual quedan bloqueados.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Reconstrucción nativa desde cero, procedencia/manifiesto, baseline drift, ausencia V1 con controles positivos, RouteCondition y limpieza protegida | PASS; 17 migraciones; ausencia V1 9/9 |
| pgTAP final, perfil V2 completo | **855/855**, 25 archivos |
| LTL operación / cancelación / previa a salida | **52/52 + 51/51 + 34/34** |
| Release | **521/521**; HAC-40 incluido **52/52** |
| Typecheck / arquitectura / build producción | PASS |
| Inventario UML / DER | PASS: 57 clases, 397 atributos, 93 relaciones; implementación/migración completa NO certificadas |
| Carreras existentes request/catalog/fleet/crew/workflow del gate | PASS en dos conexiones locales; no se presenta como prueba independiente de carrera del nuevo start LTL |

Comandos reproducibles desde el repositorio:

```powershell
python supabase-v2/gate.py v2 --evidence-dir <carpeta-fuera-del-repo> --v1-replay-port-base 61300 --baseline-replay-port-base 62300
pnpm --dir cargomesh typecheck
pnpm --dir cargomesh check:architecture
pnpm --dir cargomesh test:release
pnpm --dir cargomesh build
python scripts/check-v2-full-model.py
python scripts/build-v2-full-der.py --check
```

La primera reconstrucción recogió los 24 archivos existentes al iniciar su fase de pruebas: 821/821. Tras añadir el caso de cancelación previa, se repitió todo el perfil de 25 archivos sobre el mismo esquema reconstruido: 855/855. Los fixtures pgTAP hacen rollback. Evidencia local externa: `C:/Users/HP/AppData/Local/Temp/hac40-ltl-20261004/`; log final adicional `tmp/ltl-final-pgtap.log` (no versionado).

## Límites y siguiente paso

Operación común con ruta/ventana/crew compartidos y hasta 100 miembros. Recogidas escalonadas, relevo parcial, búsqueda automática/optimización multistop y providers GPS/routing live no quedan certificados por estos positivos. Posiciones de prueba son manuales SIMULATED. La matriz completa UML→BD→API corresponde a HAC-44; sus defectos de backend vuelven a HAC-40. Identidad/MCP depende de HAC-41; frontend de HAC-42/43. Discovery automático delegado requiere su issue/contrato y evidencia propios.

Entrega mediante PR directo a `codex/v2-amazon-contracts`. No se mergea este incremento, no se aplica DDL/seeds alojados, no se toca main/V1 hospedado ni configuración de Vercel. Las pruebas locales no demuestran Alexa/MCP live ni autorizan cerrar el gate completo.
