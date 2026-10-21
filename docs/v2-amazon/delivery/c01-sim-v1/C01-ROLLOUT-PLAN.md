# C01-ROLLOUT-PLAN

Estado: **preparado, pendiente de aprobación específica**. No ejecutado en el alojado.
Dataset `C-01-SIM v1`, SHA-256 `3ec394684362182803144cc34185614a1faa23f9bb8681c3211947ca85e39ab6`.

## Autoridad y alcance

El texto aportado por Cristhian exige revisar manifiesto, preview y plan antes de aplicar DDL, activar tarifas o publicar código. El AGENTS aportado congela main: hace falta excepción expresa para publicar este corte. No inferirla de una prueba verde. La petición posterior de activar catálogo/prueba Vercel se ejecutará después del rollout autorizado.

Alcance: costos/admisión ya preparados localmente, escenario C01 aislado y catálogo extendido de voz. No consolidación B, VRP, nuevas rutas reales, cambios globales de Carrier, modificaciones de IAM/AWS ni permisos nuevos de Supabase.

## 0. Revisión previa de solo lectura

Comprobación renovada en `PRE-ROLLOUT-READONLY.json`: cliente y Carrier ADMIN válidos, administrador técnico de catálogo existente,7límiteslegacy/sinadmission,0activos/0sedes/0políticaC01previos. De las versiones del corte solo154000 está aplicada. Datos observados el21oct; volver a leer justo antes de aplicar si pasa tiempo o hay trabajo concurrente.

Confirmar hash de manifiesto/seed y destino exacto `yhimeajpzicjbxpbzsyh`. Guardar el ledger y snapshots de los IDs preexistentes. Comparar compatibilidad estructural y vigencia, sin convertir la revisión en reparaciones de historial.

## 1. Preparar publicación revisable del código

- Partir del main remoto actual que ya incorpora PR142 de Axel; incorporar únicamente archivos propios del corte costos/admisión y escenario C01. No repetir merges de Luis/Axel.
- Preservar cambios ajenos de AGENTS.md, next-env.d.ts y caches. El checkout compartido tiene modificaciones sin commit: exportar/revisar el conjunto exacto antes de publicar; no hacer add-all, reset ni stash global.
- Las correcciones gateway preparadas son una entrega separada ya desplegada por Axel. No mezclar su empaquetado ni cambiar AWS al publicar el motor.
- Usar la rama de integración autorizada y el gate aplicable al SHA final. No omitir CI por tener una prueba local verde; no repetir suites amplias opcionales sin riesgo nuevo.

## 2. Migraciones alojadas: primero DDL, después frontend

1. `20261021175507_carrier_operating_costs.sql`, depende de154000 ya aplicada.
2. `20261021203000_resource_route_admission.sql`, depende de175507.

Verificar hashes del manifiesto, existencia de funciones base y ausencia de colisiones de nombres antes de ejecutar. No reaplicar las cinco DDL de agenda anteriores. Usar timeout de bloqueo y transacción controlada; registrar versión/statement en el ledger según el procedimiento autorizado. Si falla, rollback, conservar evidencia del error y no lanzar el frontend nuevo.

Postcondiciones: columna `private.quote_issued_offers.calculation_snapshot`, RPC de preview y lectura de admisiones, lectura de costos para Carrier, helpers privados no expuestos. Las siete filas legacy deben seguir válidas y sin modificaciones. Comprobar RLS y anon/service-role bloqueados, conservando la RPC antigua y su forma.

## 3. Publicación Vercel y catálogo de voz

Con aprobación de publicación: integrar el corte si pasa el gate y verificar el deployment READY del SHA correcto en el proyecto que sirve cargomesh.vercel.app. Mantener Root Directory, rama de producción, dominio y secretos actuales.

AWS ya tiene reporte de Axel8b7220f-auth64k/ECS:4 y handshake independiente5007bytesready. Tras la aprobación del rollout, configurar **`CARGOMESH_VOICE_EXTENDED_CATALOG=true`** en el entorno Vercel que sirve ese dominio y reconstruir. Puede prepararse antes del build de publicación para evitar dos builds, pero no habilitarlo de forma no autorizada como parte de esta preparación.

Comprobar grant nuevo y WSSready con catálogo extendido; FTL/LTL en el catálogo es orientación del dominio, no significa que toda capacidad LTL esté implementada ni que haya flota disponible. Preservar secretos fuera de chat/Git. No cambiar la imagen AWS ya desplegada.

## 4. Activación del dataset

Requiere autorización expresa del dataset y de la política de emisión por Carrier ADMIN. Aplicar el `seed.sql` revisado con hash esperado y aprobación registrada. El seed se bloquea sin esas condiciones; el flag técnico no sustituye el consentimiento.

Resolver actores exactos del manifiesto contra la base actual y preservar grants. Crear las23operaciones nativas. Capturar IDs reales en archivo de evidencia. Repetir la misma intención para comprobar que no duplica registros. No crear pedidos/bookings en esta activación y no habilitar autoConfirm.

Si se requiere PostgreSQL/psql, el ejecutor debe verificar la conexión con el proyecto autorizado; no pegar credenciales ni construir comandos con claves visibles. La CLI `db query --file` no interpreta metacomandos psql: usar un controlador que valide los mismos guards antes de enviar SQL o una sesión psql privada correctamente configurada. No quitar los guards para improvisar un rollout.

## 5. Demostración desde CargoMesh

1. Cliente abre New shipment y elige las sedes C01 A/B creadas. Introduce dos cajones6t,240×180×180cm, no apilables/indivisibles, total12t/15.552m³, repartible, fechas acordadas. Revisar y confirmar publicación.
2. Solicitar cotización: el sistema evalúa el servicio dedicado y propone ambos camiones. Comprobar un solo precio calculado y atribuible al Carrier. Si cambia el horario elegido, recalcular el precio; no imponerUSD361.20.
3. Cliente selecciona esa oferta y autoriza el booking. **autoConfirm=false:** no anunciar confirmación automática ni EnCamino por esa autorización.
4. Carrier revisa y confirma ambos recursos y el booking mediante controles nativos. Si la pantalla no permite completar esa acción, registrar el bloqueo de UI; no sustituirlo silenciosamente por SQL y llamarlo éxito web.
5. Registrar un booking y dos reservas físicas CONFIRMED, asignar los dos conductores/vehículos con sus plantillas y la ventana real de ejecución. Mantener PLANNED. No invocar start ni crear posiciones/GPS/eventos ficticios.
6. Guardar IDs reales y capturas de Cliente/Carrier, log sanitizado del resultado y SHA de deployment. Esa misma solicitud/booking debe aparecer en ambos lados. Usar scopes correctos y no mostrar costos internos al Cliente.
7. Prueba humana Nova: español, resumen y corrección de peso/dimensiones/fechas en el mismo borrador, comprobando que no se silencie. Toda creación o autorización comercial mantiene la confirmación explícita. No confundir un handshake con una conversación aprobada.

## Recuperación y conservación de evidencia

- Fallo DDL: rollback transaccional; no activar datos ni frontend incompatible. No borrar ledger ni editar migraciones históricas.
- Fallo de frontend: volver al deployment anterior conservando guardas/DDL. Deshabilitar catálogo extendido si causa regresión y reconstruir; registrar cambio.
- Activación parcial: la transacción del seed revierte; reintentar con las mismas claves y payload tras resolver causa. No usar claves nuevas para esquivar un conflicto.
- Fallo después de activar o de crear un pedido demo: pausar la política nueva mediante su comando versionado y gestionar bookings/holds por cancelación nativa cuando corresponda. No borrar historial, no tocar otros servicios ni ejecutar DELETE en cascada.
- Capturas no incluyen tokens, credenciales ni detalles personales. Separar evidencia local y alojada.

## Bloqueos y decisiones pendientes, lista corta

1. Revisar y autorizar este catálogo/precio recalculado por espera, el mandato de **emitir** ofertas para este servicio y publicación/DDL. autoConfirm sigue deshabilitado.
2. Autorizar activación del catálogo extendido en Vercel y una operación comercial sintética completa desde la web.
3. Identidad de acceso web y controles de confirmación se comprueban en la demostración: el preflight de metadatos y la prueba SQL local no los certifican.

No falta una nueva investigación del motor; las identidades y el administrador técnico ya fueron localizados. El siguiente paso es la autorización del corte concreto, no ampliar A+C.

## Controlador concreto para la etapa autorizada

Se entrega `activate-reviewed.py`. Su modo por defecto es PREVIEW sin acceso de red. La ruta --apply solo puede utilizarse después de la aprobación indicada arriba, con el SHA revisado, referencia de esa aprobación y reconocimiento del mandato de emisión Carrier. Resuelve la incompatibilidad de metacomandos psql con db query mediante un prologue equivalente validado del lado cliente; el cuerpo SQL transaccional nativo permanece íntegro. Guardará SQL revisado y resultado sanitizado; no imprime usuarios Auth ni secretos. La publicación del código y las dos DDL siguen siendo pasos separados y previos.
