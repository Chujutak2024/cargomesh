# HAC-50 — Líneas de carga, reparto, entregas y coordinación Cliente–Carrier

Fecha: 19-oct-2026. Estado: propuesta documentada para diseño posterior; no es un contrato de API aprobado ni una capacidad nueva implementada.

## 1. Dirección acordada y alcance inmediato

Prioridad indicada por Cristhian: terminar la conexión Cliente–Carrier existente. Conservar esta ampliación para retomar después el proceso FTL. Documentarla no certifica el cierre del flujo comercial-operativo ni autoriza migraciones, integración, despliegue o ampliación de alcance.

El recorrido que falta cerrar sigue siendo pedido/version → evaluación → oferta atribuible → selección → booking → compromiso de recursos → ejecución → entrega. El corte local actual de Requests aporta proyección autorizada y respuesta para revisión/rechazo; no automatiza discovery al enviar el pedido ni crea por sí solo ofertas, reservas o ejecuciones. El acceso al Supabase alojado sigue pendiente.

No rediseñar pantallas ni cambiar rutas por este documento. No crear otro motor de pedidos, ofertas o reservas. Coordinar las ampliaciones con HAC-51 (contrato/proyección), HAC-53 (captura y Nova) y HAC-54 (comercial/operación), conservando sus responsables.

## 2. Fuentes y grado de certeza

- Material aportado por el usuario: conversación titulada «que hace actualmente una empresa cuando necesita trasladar una carga de una ciudad a otra ciudad?», recibida el 19-oct-2026 como Texto pegado.txt. Es insumo exploratorio sin fuentes completas; no es normativa ni evidencia de procesos del Carrier.
- Contratos vigentes: DOMAIN_CONTRACTS.md, TRANSPORT_PLANS_AND_FLEET.md, CARRIER_COVERAGE_AND_SERVICEABILITY.md y CARRIER_DISCOVERY_AND_RANKING.md, en docs/v2-amazon/contracts/.
- Referencias visuales: distribución de mercancías dentro del camión y sede Airsup warehouse-ops compartidas por el usuario. La captura inspira visualización; no prueba un algoritmo de cubicaje ni integración operativa. La página Airsup no fue accesible con el buscador durante la consulta anterior.

Del material se retoman preguntas útiles: quién proporciona los datos, quién prepara/revisa documentos, cómo se negocian ventanas, si existe recojo o entrega en agencia y cuándo interviene un almacén. No se adoptan sus afirmaciones absolutas de que FTL siempre sale inmediatamente o nunca pasa por un almacén, que LTL siempre requiere almacenes o espera a llenar, ni sus cifras de minutos/24–48 horas como SLA. El itinerario, frecuencia, tratamiento y plazos deben constar en el servicio y oferta aplicables.

La mención de GRR/GRT, SUNAT, seguros y permisos queda como tema pendiente de investigación por jurisdicción/mercancía. Este documento no determina obligaciones legales, excepciones, tiempos de emisión ni integra una autoridad tributaria o aduanera.

## 3. Pedido con varias líneas de carga

### Estado actual

La carga tiene categoría/requisitos globales y unidades con cantidades, peso, volumen, dimensiones y atributos de división/apilado. Los planes admiten varios recursos por tramo y asignación de unidades. Eso permite representar reparto físico en el modelo, pero no acredita un flujo completo de mercancía heterogénea con requisitos independientes por línea.

### Ampliación propuesta

Mantener un pedido y su versión como referencia del Cliente. Añadir líneas identificables y versionadas dentro de él; los nombres siguientes son conceptuales, no endpoints ni tablas existentes:

| Concepto | Información propuesta |
|---|---|
| Línea de carga | ID estable de línea, descripción/categoría, embalaje, cantidad, peso y volumen unitarios/totales, dimensiones |
| Restricciones de línea | Divisible o pieza indivisible, apilado, fragilidad, temperatura y requisitos documentales/operativos conocidos |
| Asignación de carga | Pedido/version + línea + cantidad + tramo/asignación del plan + recurso portador |
| Despacho operativo | Booking(s) atribuibles, ruta/tramo, recursos, conductores por viaje, ventanas comprometidas y estado |
| Entrega/recepción | Destino/parada, cantidades por línea, receptor autorizado, fecha efectiva, resultado e incidencias |

Ejemplo sintético: un Cliente solicita insumos secos en cajas y materiales no apilables en pallets para el mismo destino. Pueden compartir equipo si su compatibilidad está comprobada. Una tercera línea refrigerada requiere un equipo compatible y condiciones verificables; no se infiere compatibilidad por disponer de espacio.

Primer alcance sugerido para esa ampliación: un origen y un destino comunes a todas las líneas, una fecha objetivo de entrega y ventanas explícitas. Recogidas/destinos distintos por línea, múltiples paradas y equipos con compartimentos se dejan para decisión posterior; no se habilitan de forma implícita.

## 4. Reparto entre vehículos y viajes

Opciones a evaluar: equipo mayor compatible, varios recursos concurrentes o varios viajes cuando las ventanas lo permitan. No se fuerza siempre un segundo camión.

Invariantes propuestas, apoyadas en el contrato actual:

1. Nunca partir una pieza indivisible entre vehículos. No sumar nominales para declarar que una pieza cabe.
2. Evaluar peso, volumen, dimensiones, requisitos y capacidad efectiva por recurso/tramo/ventana. La capacidad del servicio no sustituye la de cada vehículo; una escolta no transporta parte de la carga.
3. Descontar compromisos, mantenimiento, reposicionamiento y carga ya asignada. Conductor habitual no significa conductor reservado para ese viaje.
4. Cada cantidad de una línea se asigna una sola vez por tramo. Si pasa por varios tramos consecutivos, conservar su continuidad; no contar esas transferencias como mercancía adicional.
5. Todas las líneas deben quedar cubiertas por el plan seleccionado. Una cobertura parcial es una propuesta parcial explícita y requiere autorización; no se presenta como transporte completo.
6. Separar dividir el pedido entre vehículos de entregar parcialmente al destinatario. El Cliente debe poder expresar si admite entregas parciales y si exige recepción completa dentro de una ventana común.
7. Un plan con varios carriers conserva ofertas, responsabilidades y bookings atribuibles. No unirlos bajo un emisor o compromiso ficticio.
8. Cambiar líneas, cantidades o condiciones materiales exige versionado y revalidación comercial/operativa conforme al ciclo autorizado. No habilitar edición de un pedido PENDING por el solo hecho de documentarlo.
9. Si faltan datos para determinar compatibilidad o acomodo, mostrar revisión necesaria. Peso/volumen residual o una barra de ocupación no prueban distribución 3D, sujeción ni reparto por ejes.

El Cliente verá un pedido padre con sus despachos/entregas asociados. El Carrier verá solo el alcance autorizado que le corresponde. Vehículo/conductor dejan de ser un único campo del pedido: se obtienen de las asignaciones de cada operación/tramo, sin perder sus IDs ni historial.

## 5. Coordinación y aceptación: hechos separados

| Momento | Cliente | Carrier / CargoMesh |
|---|---|---|
| Necesidad | Describe mercancía, origen/destino, contactos autorizados, disponibilidad para recojo y entrega deseada | Identifica faltantes; todavía no promete precio ni fecha |
| Revisión | Atiende aclaraciones | Carrier acepta para revisar o rechaza; no modifica el pedido ni reserva automáticamente |
| Propuesta | Compara alcance, precio, fechas y condiciones | Carrier ofrece ventanas factibles, vigencia, desglose, exclusiones y requisitos pendientes |
| Acuerdo | Selecciona/autoriza explícitamente la oferta vigente | Se registran booking, confirmación Carrier y compromiso de recursos como hechos separados |
| Preparación | Aporta datos/documentos que le correspondan según la regla aplicable | Responsable verifica requisitos, citas, recursos y condiciones de salida |
| Recojo/custodia | Entrega mercancía según coordinación | Se registra recepción física y diferencias de cantidades/condición; aceptar para revisión no equivale a recibir carga |
| Entrega | Destinatario autorizado recibe o informa diferencias | Se registra recepción por línea/cantidad, incidencias y saldo pendiente |

**Fechas:** distinguir ventana solicitada, propuesta por Carrier, comprometida y fecha efectiva, con zona horaria explícita. También distinguir vencimiento de la oferta y plazo de respuesta de las ventanas operativas. La duración de Google es una estimación de conducción; preparación, carga, espera, descanso, descarga y contingencias no se reducen a ese tiempo.

**Documentos:** proponer una lista de requisitos con tipo, ámbito (pedido/línea/tramo), responsable, regla y fuente, vigencia y estado verificable. Distinguir faltante, aportado, revisado y confirmado por quien tiene atribución. No es una máquina de estados nueva aprobada. Un archivo adjunto no demuestra validez; una respuesta de Nova no emite guías ni acredita liberación aduanera.

**Nova:** ayudar a capturar líneas, señalar datos faltantes/incompatibilidades y explicar alternativas o pendientes. Puede preparar un resumen para revisión humana. No inventa documentos, precios finales, capacidad o consentimiento, ni acepta automáticamente un cambio de fecha o entrega parcial.

## 6. Entregas y excepciones que debe conservar el diseño

- Recepción completa, parcial, rechazada o con diferencias son resultados distintos. La entrega total del pedido depende de las cantidades recibidas/aceptadas de todas sus líneas y de la política acordada.
- Guardar cantidades enviadas, recibidas, rechazadas y pendientes por línea, con unidades coherentes y sin duplicar un registro al reintentar. No definir aquí reglas de tolerancia o equivalencia de unidades no aprobadas.
- Evidencia de recepción, actor, fecha y zona horaria; contactos/direcciones exactas se revelan por etapa y ámbito autorizados.
- Incidencias por daño, faltante, demora, destino cerrado o rechazo se vinculan a pedido, línea, despacho y ejecución pertinentes. No confirmar entrega por llegar al punto del mapa.
- Reasignar un vehículo/conductor requiere disponibilidad y trazabilidad; no duplicar capacidad ni borrar el historial original. Devoluciones, reintentos de entrega y cancelaciones parciales requieren reglas comerciales por definir.

## 7. Relación con FTL, consolidación y sedes

Varias clases de mercancía de un mismo Cliente dentro de un pedido no equivalen a consolidar pedidos de varios clientes. FTL/LTL describen el servicio comercial contratado; no se deducen únicamente del porcentaje de ocupación. Repartir una solicitud entre dos camiones tampoco la convierte automáticamente en LTL.

Para retomar FTL después: decidir exclusividad/capacidad comprometida, unidades necesarias, ruta/paradas permitidas, modalidad de recojo/entrega, manipulación, tiempos de preparación y condiciones de aceptación/recepción. El servicio/oferta determina si hay paso por Depot o LogisticsNode; no se fuerza un almacén por defecto ni se prohíbe por una etiqueta.

Sedes: representar primero patio/muelles, colas, pedidos asignados, carga/descarga y salida de vehículos con la misma fuente operativa. Las Facilities Cliente, Depots Carrier y nodos compartidos conservan funciones distintas. Inventario por SKU, picking, packing, robots o gemelo digital de almacén quedan fuera de este corte; las animaciones simuladas deben seguir identificadas.

## 8. Secuencia de continuidad y decisiones pendientes

1. Terminar el recorrido Cliente–Carrier existente con pedido, oferta, selección, booking, recursos y entrega; no sustituirlo por la ampliación visual.
2. Acordar esquema/versionado de líneas y compatibilidad; decidir si la propuesta inicial conserva exclusivamente origen/destino comunes.
3. Definir política de reparto y de recepción parcial/completa; relacionarla con oferta, reservas y ejecución existentes.
4. Retomar detalle de FTL con ese alcance acordado. Consolidación entre clientes y múltiples paradas no se presumen incluidas.
5. Reflejar el resultado operativo en camión/sede sin calcular indicadores ficticios como si fueran datos reales.

Preguntas para esa definición posterior: ¿se permiten varios viajes?, ¿entregas parciales?, ¿todo debe llegar en una ventana común?, ¿varios carriers o uno responsable?, ¿qué datos de compatibilidad son obligatorios?, ¿quién confirma cada documento y en qué etapa?, ¿qué ocurre ante recepción parcial o rechazo?

No se ejecutan pruebas nuevas para esta documentación. Para implementación posterior, limitar verificación automática a riesgos importantes: pérdida/duplicación de cantidades, incompatibilidad/indivisibilidad, doble reserva, acceso entre organizaciones y confirmación de entrega incompleta. La revisión visual/de uso corresponde al usuario según su instrucción; no se impone a este chat el gate de capturas de las tareas delegadas.
