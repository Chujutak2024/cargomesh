# A-12 y continuidad C-01 — corte local

21 octubre 2026. Alcance: A + C. Consolidación B, ruteo avanzado y multimodal permanecen fuera de este corte. No se activaron seeds, tarifas, migraciones alojadas ni despliegues.

## Implementado

- `limits.publish` admite una decisión opcional `admission: {decision, reasonCode}` dentro del límite existente por recurso/corredor. Se conservan identidad, permisos de Carrier ADMIN, versionado, idempotencia, evidencia y RLS existentes. No se creó una tabla ni un segundo catálogo de permisos.
- Decisiones persistidas: **ALLOWED**, **DENIED**, **UNKNOWN**. **EXPIRED se calcula** desde la evidencia y la ventana de ejecución; no se permite publicarlo como una autorización duradera.
- La decisión explícita debe coincidir con `compatibilityConfirmed`: ALLOWED exige true; DENIED/UNKNOWN, false. Un registro histórico true solo equivale a permitido con evidencia suficiente y vigente; false significa desconocido, nunca una prohibición inventada.
- La generación usa la misma regla de vigencia y excluye recursos no admitidos. A-12 deniega H1 y selecciona M1+M2 por costo interno sintético 760, conservando intactos capacidad, mantenimiento y clase de vehículo.
- Preview de costos, emisión y confirmación nativa vuelven a consultar los límites actuales. Una decisión anterior no permite confirmar un recurso denegado posteriormente. Los datos desconocidos o vencidos mantienen revisión.
- La nueva lectura `read_v2_dispatch_options_with_admission` mantiene el contrato previo de `read_v2_dispatch_options`. El preview conserva la validación nativa de organización/solicitud/política antes de devolver una decisión. La forma pública previa de los snapshots de plan no recibe campos nuevos obligatorios.
- El esquema común de evidencia se extrajo a `evidence.ts`, conservando la exportación original desde `commercial.ts`, para evitar un ciclo de imports entre solicitud, despacho y evidencia.

## C-01 probado en integración local

La prueba nativa reutiliza la **misma oferta COST_PLUS** calculada por perfiles heterogéneos hasta el booking:

1. Dos cajones de 6000 kg, cada uno 240×180×180 cm / 7.776 m³; total 12000 kg / 15.552 m³, sin apilar.
2. Dos activos de 10000 kg de capacidad útil. El fixture distingue 30 m³ geométricos de **28 m³ útiles sintéticos**, propuesta exclusiva de prueba; no constituye aprobación del catálogo alojado.
3. Una oferta atribuible al Carrier con precio autorizado del fixture **USD 310.80**, selección del Cliente, un booking y dos reservas físicas confirmadas.
4. Se verifica que el booking conserva el precio, las dos asignaciones y las 12 toneladas. Su reintento devuelve el mismo booking y no añade reservas.
5. Denegar el segundo recurso después de cotizar impide confirmar el hold y el booking; no aparece una confirmación parcial presentada como operación completa. Cambiar a UNKNOWN o dejar vencer evidencia tampoco habilita el plan.
6. Restablecer ALLOWED mediante un comando con versión esperada permite completar el flujo. La ejecución permanece **PLANNED**, sin fabricar un evento IN_TRANSIT.

**Es una integración local sintética.** El trayecto de 100 km, duraciones, tarifas, coordenadas y fechas relativas del fixture no son una medición real Lima–Arequipa ni el escenario alojado final. La prueba no acredita puerta de carga, geometría conjunta arbitraria ni habilitación/disponibilidad de dos conductores reales. No es una conversación con Nova ni una prueba visual.

## Evidencia ejecutada

| Comprobación | Resultado |
|---|---|
| Dominio: matriz, admisión, despacho y costos | 46 PASS, 0 fallos, 0 TODO |
| Native `45_v2_operating_costs.test.sql` | 40 assertions PASS |
| Native `46_v2_route_admission.test.sql` | 64 assertions PASS |
| TypeScript sin emitir/cache | PASS |
| Arquitectura | PASS, 694 módulos / 203 entradas cliente |

Las pruebas SQL se ejecutaron en una base local temporal, con fixtures autorizados de prueba, rollback y eliminación de esa base. No se copiaron usuarios/pedidos del alojado. Los conteos incluyen regresiones compartidas; no se suman a ejecuciones anteriores como cobertura nueva.

Se corrigieron durante el trabajo un ciclo de imports, una unión contra la tabla histórica en vez de `plan_resource_bindings` y una comparación textual de `310.8000000000000000` frente a `310.80`; el precio numérico era correcto. La comprobación de alcance del preview se mantiene antes de devolver admisión. Se repitieron las verificaciones afectadas hasta obtener los resultados de la tabla.

Logs y resultados: `salida/costos-prs-20261021/45_v2_operating_costs.test.sql.log`, `46_v2_route_admission.test.sql.log`, `native-admission-cases.json` y `ADMISSION-RESULTADO.json`. Reproductor local: `verify-native-admission.py`.

## Precio y costo

Los costos internos y el markup permanecen privados. El Cliente compara **ofertas finales vigentes**, no los valores 170/380/700 del Dataset A. La búsqueda programada actual compara totales autorizados por servicio; no se afirma un optimizador separado de rentabilidad global del Carrier. Los importes A y USD 310.80 solo aíslan decisiones del fixture; no aprueban tarifas comerciales.

## Qué sigue pendiente antes del cierre alojado

- Acordar el catálogo A/C: dimensiones nuevas A no se sustituyeron silenciosamente. H1 sigue con propuesta de 50 m³ útiles frente a una envolvente geométrica de 50.96; C.T1/T2 tienen propuesta de 28 m³ útiles frente a 30 geométricos.
- Confirmar identidades y roles a reutilizar, sedes/coordenadas exactas, horarios, trayecto dirigido, admisión de ambos camiones, conductores y calendarios para C-01 alojado. Las fechas 23–24 octubre son tentativas.
- Aprobar perfiles de costos, moneda, términos, tratamiento de gastos obligatorios y política comercial. No presentar un retorno obligatorio sin precio como un total completo confirmado.
- Acreditar la carrera real de dos sesiones por el mismo recurso/ventana y el segundo camión ocupado entre oferta y confirmación. Esta entrega demuestra denegación sobrevenida y reintento; no afirma haber ejecutado una prueba concurrente de dos conexiones.
- Completar la evidencia específica de oferta vencida/alterada y actor de otra organización en C-01, reutilizando los negativos existentes cuando correspondan. Los tests de privilegios ejecutados aquí no equivalen a toda la matriz de autorización.
- Publicar el corte y aplicar, con autorización específica, las dos DDL locales pendientes: `20261021175507_carrier_operating_costs.sql` y `20261021203000_resource_route_admission.sql`. La segunda depende de la primera. Prepararlas no autoriza main ni el alojado.
- Activar únicamente el escenario acordado y demostrar el flujo desde la web. El despliegue de voz sigue con Axel; Nova no bloquea la comprobación del dominio.

## Hitos

1. **A-12 lógico/nativo implementado localmente.** Publicación y catálogo final pendientes.
2. **Continuidad comercial COST_PLUS local acreditada** para el positivo, denegación/vigencia y reintento; los negativos adicionales indicados arriba siguen en el gate de C-01.
3. **Alojado pendiente.** No hay demostración nueva en Vercel ni datos activados por este corte.

## Actualización: cuatro gates transaccionales cerrados localmente

G-01 a G-04 pasan con 38 comprobaciones focales: contención real entre dos conexiones, rollback del segundo recurso, vigencia/integridad comercial y aislamiento de identidades extranjeras. El reproductor y los límites precisos están en [C01_TRANSACTION_GATES_2026_10_21.md](./C01_TRANSACTION_GATES_2026_10_21.md). Esta evidencia sustituye el pendiente local de concurrencia y negativos citado arriba. El catálogo sigue por acordar; el ledger y la ejecución alojada siguen pendientes. No hubo publicación ni nuevas seeds/tarifas.
