# Matriz Carrier incorporada al corte local

> Actualización posterior: A-12 ya está implementado y verificado localmente. La ejecución inicial descrita debajo se conserva como historial; consultar [el corte actual de admisión y C-01](./RESOURCE_ROUTE_ADMISSION_2026_10_21.md).

21 de octubre de 2026. Fuente: `CargoMesh_Matriz_Casos_Optimizacion_Carrier_2026-10-21.md` y texto adjuntos por Cristhian. Especificación de trabajo, sin activación de seeds, datos comerciales o despliegues.

## Separación aceptada

1. **Una solicitud → varios planes posibles.** Repartir unidades enteras entre activos de un mismo Carrier/servicio; comprobar capacidad y agenda; calcular costo privado de cada plan y precio bajo política autorizada. La búsqueda local enumera subconjuntos y usa el planificador de bultos existente. La matriz fija máximo dos recursos para sus casos; el máximo configurable actual del producto es ocho. No sustituirlo globalmente por dos.
2. **Varias solicitudes → una operación compartida.** Segunda capacidad, todavía no implementada. Mantiene pedidos y contratos independientes; exige consentimiento, compatibilidad, ventanas, desvíos, asignación de ingresos/costos y un único consumo físico de capacidad. No reutilizar el generador del primer punto como supuesto consolidador.

Nova interpreta y explica resultados autorizados del dominio. No decide capacidades, inventa camiones, calcula tarifas en el prompt ni autoriza reservas por inferencia.

## Qué se incorporó ahora

Archivo ejecutable `cargomesh/src/server/modules/commercial/domain/dispatch-matrix.test.ts`, usando **las funciones reales** `proposeDispatchAlternatives`, `planWholePackages` y `calculateFleetOperatingCosts`. Cada caso crea una flota independiente en memoria; no escribe en Supabase. Se añadió `test:carrier-plan-matrix` y se conectó la matriz a `test:release` y `test:carrier-commercial`.

La flota ficticia L1/L2/M1/M2/H1 se asigna por ID explícito; su capacidad útil y dimensiones no se infieren de N1/N2/N3. Esas categorías legales no se usan como bandas de carga ni fórmulas de precio. No se ha implementado una clasificación legal completa ni una auditoría normativa nueva.

En el fixture, cada costo completo por viaje es un cargo fijo privado por vehículo (170/380/700), con variables, manejo, margen e impuestos en cero, exclusivamente para aislar la decisión de la matriz. **No son parámetros comerciales sugeridos ni un reemplazo del algoritmo de combustible/conductor/reposos** ya preparado. Las pruebas anteriores mantienen cobertura de ese algoritmo. Los importes se comparan como unidades monetarias homogéneas del fixture; no emiten ofertas PEN ni convierten esos números en USD. El corte comercial vigente sigue limitado a USD.

## Resultado por caso

| Caso | Estado local nuevo | Evidencia / límite |
|---|---|---|
| A-01 | PASS | 900 kg → L1, 170 |
| A-02 | PASS | Dos piezas de 1 t → L1+L2, 340 < M1, 380 |
| A-03 | PASS | Una pieza de 2 t → M1; no se parte |
| A-04 | PASS | Tres piezas de 1 t → M1, 380 |
| A-05 | PASS | Cinco piezas → L1+M1, 550 |
| A-06 | PASS | Siete piezas → H1, 700 |
| A-07 | PASS | Pieza única 4.5 t → H1 |
| A-08 | PASS | 900 kg / 9 m³ → M1; volumen manda |
| A-09 | PASS | Pieza de 5.5 m → H1; longitud manda |
| A-10 | PASS | L2 en mantenimiento → M1 |
| A-11 | PASS, sin plan | M1/M2/H1 ocupados; no inventa otra unidad |
| A-12 | PENDIENTE explícito | Falta admisión/prohibición persistida por activo y corredor; no simularla usando mantenimiento |
| A-13 | PASS | N1 disponible tarde, recepción cierra 20:00 → M1; no gana una oferta tardía por ser barata |
| A-14 | PARCIAL | Calendario vencido y evidencia de costo vencida no producen plan/costo listo. No es una nueva prueba de toda la vigencia de oferta/autoridad nativa |
| C-01 | Asignación PASS | Servicio 20 t + dos camiones 10 t → dos cajones indivisibles de 6 t, uno por recurso. Ruta A–B ficticia; no demuestra viaje real Lima–Arequipa ni booking alojado |
| C-02 | PASS, sin plan | Servicio limitado a 10 t por solicitud rechaza 12 t |
| C-03 | PASS, sin plan | Un solo camión 10 t libre no transporta dos piezas de 6 t |
| C-04 | PASS, sin plan | Tránsito fuera de recepción no se acelera para hacerlo pasar |
| C-05 | PARCIAL | Procedencia ESTIMATED no produce costo listo; validaciones de reposo en pruebas anteriores. Retorno/reposicionamiento obligatorio aún no está modelado en costos |
| B-01…B-05 | DISEÑO | Consolidación multiorden no implementada ni acreditada por esta suite |

La matriz nueva registra **18 pruebas PASS y un TODO A-12**. Con costos, agenda y reparto existentes: **47 PASS, 0 fallos, 1 TODO**; conteos anidados, no se suman. `NO_FEASIBLE` es el resultado esperado de negocio en ciertos casos: el contrato actual conserva una respuesta conservadora `REQUIRES_REVIEW` cuando no puede producir un plan verificado; no se cambió el enum público para fingir esa distinción.

## Brechas físicas y comerciales que no debemos ocultar

- Dimensiones actuales: encaje individual erguido, con giro en el piso, más peso/volumen acumulados. **No es acomodo geométrico completo de todos los bultos**, ni puerta de carga, distribución por ejes, centro de gravedad o apilado. Las piezas pequeñas de esta matriz permiten un acomodo simple; pasar estos casos no certifica cualquier cargamento. La validación nativa actual tampoco adquiere esa garantía por pasar TypeScript.
- A-12 necesita ficha/condición de acceso por recurso/corredor con procedencia, vigencia y versión, igual en generación, preview nativo, emisión y booking. Falta prueba positiva M1+M2 y negativa de datos desconocidos; no inferir una prohibición legal solo de N3.
- La agenda del vehículo no demuestra por sí sola licencia ni disponibilidad de un conductor específico. La confirmación nativa de tripulación mantiene su verificación separada.
- El costo actual cubre trayecto directo, conducción, descansos publicados y tareas/espera. No calcula retorno vacío, desplazamiento inicial independiente ni rutas distintas por camión. Si son obligatorios en el caso, falta modelarlos antes de activar una oferta de costo completo.
- El modo COST_PLUS sigue siendo local, sin aplicar `20261021175507_carrier_operating_costs.sql` al alojado. Ningún importe adjunto constituye aprobación comercial.

## Orden de continuación

1. Axel despliega el gateway corregido; comprobar handshake ampliado antes de habilitar catálogo extendido. Entrega preparada en `salida/axel-gateway-20261021/PARA_AXEL.md`.
2. Completar admisión por recurso/corredor y acomodación física con contrato nativo y casos negativos; mantener revisión ante faltantes. Conservar límites de búsqueda y no prometer óptimo global.
3. Acordar conjuntamente los datos reales o explícitamente simulados de C-01: empresa/sedes, coordenadas, corredor dirigido, capacidades, dos vehículos/conductores/calendarios, descansos, parámetros y fuentes. Plan 3 materializa las seeds cuando estén acordadas; esta suite no las activa.
4. Publicar/aplicar el corte de costos con autorización específica; ejecutar C-01 en el alojado: intake → oferta atribuible al Carrier → selección/consentimiento → un booking por esa oferta → dos reservas físicas → PLANNED. No adelantar a IN_TRANSIT.
5. Consolidación B en iteración independiente: agregado de ejecución compartida, acceso a cada solicitud, consentimiento, contabilidad, rutas/paradas, desvíos y no doble reserva. Un solver de ruteo futuro debe respetar los mismos contratos y revalidación nativa; no se añadió OR-Tools ni metaheurística ahora.

## Trazabilidad

La matriz adjunta tiene 24 casos de diseño (14 A, 5 B, 5 C). Este informe distingue qué parte se ejecutó; no afirma 24 capacidades terminadas. Se conserva la guía `GUIA-Y-CASO.md` y sus cifras hipotéticas separadas del fixture monetario de esta matriz. Los casos son SYNTHETIC, no HISTORICAL ni disponibilidad vigente. Sin nueva consulta de datos privados, nuevas seeds, escrituras alojadas, deploy AWS/Vercel o pruebas visuales.
