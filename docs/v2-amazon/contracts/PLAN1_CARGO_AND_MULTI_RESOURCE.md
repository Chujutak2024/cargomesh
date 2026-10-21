# Carga y operación: grupos y varios recursos ROAD/FTL

## Alcance del incremento

Un origen y un destino comunes, un Carrier y servicio por plan automático, una lane dirigida, grupos de bultos enteros y recursos portadores registrados. Se conservan los contratos de ofertas complementarias y varias reservas existentes. Una oferta puede cubrir dos camiones y producir un solo booking con dos holds.

Categoría, temperatura y requisitos siguen siendo comunes al pedido. Categorías distintas por línea, entregas parciales y múltiples destinos permanecen en la propuesta posterior `HAC50_CARGO_LINES_ALLOCATION_DELIVERIES_2026-10-19.md`; este incremento no los habilita.

## Grupos y versiones

El formulario permite añadir/quitar grupos de cajas, pallets u otros embalajes del catálogo. Cada grupo captura cantidad, peso/volumen unitarios, dimensiones en cm, indivisibilidad y apilado. Los totales se derivan de todos los grupos. Se conserva el primer grupo en los campos anteriores del borrador para compatibilidad; `additionalUnits` transporta los demás, y `updateCargoGroups` realiza una actualización atómica e invalida evaluaciones anteriores.

Los identificadores del editor son locales y estables durante la edición. `originalIndex` conserva metadatos no expuestos como `unitsPerPackage` al quitar/reordenar grupos. El contrato persistido sigue usando `unitIndex` dentro de una **versión de solicitud**, no un identificador global de mercancía. Una revisión produce otra versión y exige revalidar los planes; no se reasignan reservas de la versión anterior. No se habilita edición libre de solicitudes enviadas.

Plan2 puede consumir `cargoGroups`, `replaceCargoGroups`, `cargoGroupInput` y la acción `updateCargoGroups` de la misma sesión. Las correcciones conversacionales existentes del primer grupo preservan los demás; la captura multigrupo mediante Nova pertenece al adaptador del Plan2 y no se declara terminada aquí.

## Ruta y capacidad

En una carga repartible, el chequeo preliminar del corredor compara su límite de payload con la mayor pieza completa, no con el peso de todo el pedido. Para una carga que debe viajar junta compara el total. Esto solo evita un rechazo prematuro: no confirma capacidad. La evaluación nativa del plan sigue verificando asignaciones completas, límites del fabricante y corredor, dimensiones, evidencia, calendario, reservas, mantenimiento y reposicionamiento por recurso.

El constructor nativo rechaza más de un portador por tramo si `divisible=false` con `SHIPMENT_SPLIT_NOT_ALLOWED`; los auxiliares no aportan carga. Una pieza indivisible de 12 t nunca se transforma en dos piezas de 6 t.

## Búsqueda automática

`WHOLE_PACKAGE_BACKTRACK_V1` evalúa recursos portadores registrados y disponibles del servicio con las reglas ROAD existentes, distribuye cantidades enteras y verifica que compartan lane y ventana. Busca primero el menor número de recursos dentro de los límites declarados: 200 bultos, 64 recursos candidatos, 8 seleccionados y 50 000 nodos y 50 000 comprobaciones de compatibilidad. El orden de recursos es determinístico. No garantiza optimización global de costos, acomodo 3D o cobertura del universo multimodal.

Si se excede un límite o no existe un plan verificable, responde `REQUIRES_REVIEW`; no convierte datos desconocidos en disponibilidad ni muestra cobertura parcial como completa. La evaluación previa muestra un reparto multicamión como pendiente de validación nativa (`unknown`), sin sumar calendarios ni atribuir el total a un vehículo. La propuesta se vuelve a validar con los comandos SQL nativos antes de crear la oportunidad. Los cupos y combinaciones explícitas siguen soportados por el workflow anterior; no se inventan automáticamente combinaciones tracto/remolque ni escoltas.

## Autorización tarifaria

La política anterior equivale a `maxResources=1`. Para emitir automáticamente una oferta de varios recursos, un operador ADMIN del Carrier debe aprobar una nueva versión con `maxResources` (1–8) y `resourcePricing`:

- `PER_PLAN`: los importes aprobados cubren el plan completo.
- `PER_RESOURCE`: cada componente monetario aprobado se aplica a cada recurso portador.

Se mantienen moneda USD, redondeo por componente, desglose, vigencia, emisor y snapshot de la política. No se duplica la tarifa demo de USD 500 por inferencia. Sin autorización suficiente se crea una oportunidad pendiente de Carrier, sin oferta fabricada. La huella del reparto diferencia candidatos; la misma clave y payload reproduce el recibo, y una clave reutilizada con otro payload produce conflicto.

## Booking y operación

Cliente revisa el reparto por grupo, vehículo, peso, volumen y ventana en la oferta. Carrier consulta el mismo reparto en su ficha autorizada. Preparar recursos requiere consentimiento vigente del Cliente y crea la ejecución PLANNED y los holds de cada recurso; no indica salida ni confirma por Carrier. Un booking de dos camiones no puede confirmarse con solo un recurso comprometido. La tripulación y salida reutilizan sus comandos y validaciones existentes.

## Rollout y evidencia

Migraciones aditivas: `20261021034000_plan1_resource_route_payload.sql` y `20261021035000_plan1_multi_resource_quotes.sql`. Las migraciones históricas no se modifican y no se añaden seeds. La segunda conserva RLS/privilegios y amplía la huella de dispatch; las políticas existentes siguen limitadas a un recurso.

Casos nativos: `42_v2_multiple_trucks.test.sql` (incluye la corrección del caso antes limitado) y `43_v2_plan1_multi_quotes.test.sql` (política explícita, idempotencia, oferta única, dos holds, confirmación completa y rechazo de reparto no permitido). El caso 40 conserva la regresión comercial previa. Estos casos usan fixtures sintéticos y rollback; no activan datos alojados.

Antes de publicar: aplicar ambas migraciones en orden y desplegar el código compatible; después un ADMIN autoriza explícitamente la política multicamión y Plan3 prepara ventanas, vehículos y límites documentados. El contrato ampliado requiere el backend SQL actualizado. No presentar el código local como disponible en Vercel antes del despliegue autorizado.
