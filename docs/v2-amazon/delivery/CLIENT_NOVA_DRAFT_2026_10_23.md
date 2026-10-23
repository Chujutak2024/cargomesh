# Cliente y conversación Nova — borrador compartido

Validación local del 23 de octubre de 2026, sobre `main` base `5f37cb2c8e5340f2dc8a5c252c7817005c66e415` más cambios sin commit. Alcance solicitado por Luis: correcciones en el mismo borrador, revisión/confirmación, guardado/reapertura y estados de carga/transición. No es un cierre de Linear ni una certificación del alojado.

## Resultado contra el alcance

| Criterio | Implementación y evidencia |
|---|---|
| Un solo borrador | Formulario y conversación usan el controlador compartido. Las correcciones que llegan durante recuperación/recarga se conservan; una respuesta anterior no resucita un borrador reiniciado. |
| Correcciones visibles | «Corrige el peso por unidad a 700 kg» actualiza el campo correcto y deriva 8 × 700 = 5600 kg. No convierte un total ambiguo en peso unitario. La revisión hablada respeta la última corrección de origen/destino. |
| Revisión y confirmación | Resumen ES/EN con grupos de carga, embalajes, ventanas alternativas y valores legibles; no IDs internos ni `[object Object]`. Cada cambio invalida el consentimiento anterior. Se conserva la caducidad de cinco minutos, la versión esperada y la confirmación explícita. |
| Guardado | Se mantiene la misma API nativa e idempotencia. La revisión actualiza el ID existente; no crea otra solicitud. La evaluación ROAD anterior se oculta mientras hay cambios locales. |
| Reapertura | Recarga real del navegador y apertura del detalle nativo recuperaron el mismo ID, versión 2 y carga corregida. |
| Cargas/transiciones | Estados diferenciados de guardado, revisión, lectura y evaluación. Se bloquean acciones incompatibles mientras está pendiente la operación. Una evaluación tardía no aparece sobre datos nuevos. |
| Estabilidad visual | El contenido largo desplaza solamente la conversación, no el encabezado/compositor. Revisiones adaptables comprobadas a 1280×720, 390×844 y 320×568; override de viewport restaurado. |

## Prueba de navegador y lectura de base

App `http://127.0.0.1:8080`, API/DB exclusivamente Docker `cargomesh-v2-local` (`61321`/`61322`). Organización y mercancía sintéticas, sin contratación de transporte.

1. Cargar ejemplo V2 y corregir peso mediante conversación; indicar prioridad programada/carga mediana y ventanas del 25 y 27 de octubre.
2. Revisar y confirmar: se crea `459bb28f-afbf-4fdd-bd48-3e850f196ef0` (`PED-1300`) v1, 700 kg/unidad y 5600 kg totales.
3. Corregir a 750 kg y revisar; corregir nuevamente a 800 kg. Desaparece la confirmación anterior. La base permanece en v1/700 kg hasta una nueva confirmación.
4. Revisar y confirmar de nuevo: el mismo ID pasa a v2, 800 kg/unidad y 6400 kg totales.
5. Recargar y abrir «Continuar solicitud»: el detalle nativo y el borrador compartido muestran v2 y 6,4 t. No hay errores de consola en la pestaña final.

Recuento final: 35 solicitudes frente a 34 iniciales (una solicitud sintética de esta prueba); las reservas permanecen en 17. No se afirma elegibilidad ni geometría inexistente: el catálogo local devolvió candidatos no elegibles/desconocidos y el mapa mantuvo su estado sin coordenadas.

Capturas locales fuera del repositorio: `C:/Users/holap/Documents/Codex/artifacts/client-nova-draft-2026-10-23/`: `review-mobile-390.png`, `review-mobile-320.png`, `reopened-request-native.png`, `reopened-shared-draft-v2.png`.

## Entorno y fricciones resueltas

- La base se detenía en `20261020150746`, rechazando `planningPreferences` con `VALIDATION_ERROR`. Con autorización del usuario se respaldó y aplicaron en una transacción las 12 migraciones existentes e inalteradas de `main`, desde `20261020234155` hasta `20261022100000`. No se creó/modificó SQL histórico, no hubo reset ni seed. Historial final: 49 migraciones.
- Respaldo privado: `C:/Users/holap/Documents/Codex/CLIENT-NOVA-private-backups/v2-before-nova-2026-10-23T05-48-58-553Z.dump`, SHA-256 `83b60f31637b5fc0df820d7535921555d8f3b915d2a5d0064523639d4053c43a`. Archivo verificado con `pg_restore --list`. Recuentos antes/después de migrar idénticos: 34 solicitudes, 17 reservas, 4 sedes y 5 usuarios. El script `client-nova-local-upgrade.mjs` fija banco, puerto y SHA aprobado; nunca contacta el alojado.
- El test de referencia de oportunidad Carrier aún esperaba identidad de oportunidad en un código que ya representa al pedido padre. Se corrigió únicamente esa aserción: mismo pedido → misma referencia; distinto pedido → distinta referencia. No se cambió lógica Carrier.
- La prueba SQL 44 presupone un banco limpio: colisionaban códigos/versiones existentes y faltaba su actor Carrier sintético. El harness `client-nova-local-sql-qa.mjs` aplica namespace de fixture, actor y aislamiento de rutas **dentro del rollback de esa prueba**. Las 30 aserciones originales se mantienen, incluida la cardinalidad; no se debilita ninguna. La prueba 48 añade cuatro aserciones. Al terminar se comprueba que solicitudes, reservas, actores y estados de rutas no cambiaron.

## Verificación reproducible

Desde `cargomesh/`:

```powershell
pnpm release:verify
pnpm test:v2-intake
pnpm test:shipper-portal
$env:CLIENT_NOVA_AUTHORIZE_LOCAL_QA='1'
node scripts/client-nova-local-sql-qa.mjs
```

Resultado del gate: typecheck, arquitectura (740 módulos / 219 entradas cliente), workspace-demo 46, release 562, recetas ordenadas 9, incident-recovery 4, conversación 99 + 26 de transporte/lifecycle Nova, chat-workflow 81, carrier-commercial 118, logistics 152 y build. Suites adicionales: intake 63, shipper-portal 122. SQL local: 30 + 4, con rollback. Los conteos de suites se solapan; no son un total de pruebas únicas.

Logs fuera de Git: `C:/Users/holap/Documents/Codex/CLIENT-NOVA-private-backups/`.

El gate final completo terminó con código 0 (`release-verify-2026-10-23-final.log`). Se restauró únicamente la referencia generada de `next-env.d.ts` que cambia durante el build. Durante la verificación apareció en `origin/main` el commit documental `795c973` (#158), sin cambios de aplicación/SQL ni solapamientos con este trabajo; no se hizo pull/merge como parte de esta entrega local.

## Límites de la evidencia

La bandera local de voz Nova está desactivada; el navegador usa interpretación guiada por reglas. El camino común de borrador y las regresiones de turnos Nova están cubiertos por código/tests, pero **no se declara una conversación audible Nova en vivo validada**, ni aceptación humana de audio/Alexa+. No se cambió AWS, gateway, secretos, Supabase alojado, Vercel ni permisos persistentes. Durante esta validación no se hizo commit ni push. Los cambios previos del sidebar del usuario se conservaron.

## Publicación autorizada

Posteriormente el usuario solicitó el push a `main`. Antes de publicarlo se verificó la base `795c973` contra `origin/main` y se repitieron typecheck, chat-workflow (81), conversación (99 + 26), shipper-portal (122) y carrier-commercial (118), todos con resultado correcto. La entrega incluye también el ajuste previamente solicitado del sidebar: Reservas/Historial permanecen como pestañas internas de Mis cargas. No se incluyen respaldos, secretos ni nuevas migraciones; los helpers de base son locales y requieren autorización explícita de ejecución.
