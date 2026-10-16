# Plan propuesto — cobertura, ocupación de sedes y carga sensible

15 de octubre de 2026. Propuesta para revisar antes de implementar. No cambia contratos normativos, aplicación, base de datos ni permisos. Sustituye el orden anterior que empezaba por embellecer rutas.

## 1. Resultado buscado

Un escenario V2 reproducible con 10 carriers, 80 vehículos, 80 conductores y unas 16 sedes. Cada servicio declara sus zonas y conexiones; la vista Sede muestra vehículos presentes, esperados y en movimiento con actividades coherentes. El cálculo de rutas utiliza esa cobertura y respeta requisitos básicos de conservación y tiempo de la carga.

El número 10 es tamaño del escenario, nunca una lista permitida en dominio. Una sede/carrier sin vehículos también debe funcionar. Todo dato del escenario se identifica como SIMULATED, incluso si está persistido.

## 2. Aclaración de Sede aceptada

La pantalla Sede responde «qué vehículos están aquí y qué hacen». El dato administrativo `homeDepotId` permanece como asociación de base, pero no es el selector que construye la lista de presentes.

Separar dimensiones:

| Dimensión | Valores de presentación propuestos |
| --- | --- |
| Presencia | AT_SITE, OUTSIDE, UNKNOWN |
| Movimiento | STATIONARY, TO_PICKUP, TO_DELIVERY, TO_SITE, DEPARTING |
| Actividad | PARKED, WAITING, LOADING, UNLOADING, MAINTENANCE |
| Asignación | Sin asignación, asignado/reservado con ventana |
| Condición | Los estados del activo existentes; no convertirlos en estados de ubicación |

Son propuestas de proyección/escenario, no enums nuevos ya implementados.

Presencia se acredita mediante entrada/salida registrada por operador o eventos del escenario. GPS no es requisito para este primer corte. Registrar quién reporta, fuente, hora y versión; no promover una cita, mantenimiento programado o ETA a presencia actual. Un camión estacionado puede estar reservado para después. Ubicación desconocida se conserva como desconocida.

La lista de llegadas previstas incluye vehículos que todavía no están dentro. Su ETA puede quedar pendiente si no existe cálculo. Un mismo assetId no aparece dentro de dos sedes. La salida conserva identidad del vehículo y viaje al pasar a Ruta.

### Visitas de otro Carrier

Puede mostrarse un vehículo de otro Carrier cuando participa en una visita/envío compartido autorizado. El anfitrión ve únicamente el contexto de visita necesario: identidad de vehículo, Carrier, actividad, estado y ETA disponible. No recibe acceso a toda la flota, agenda, conductores/contactos o pedidos del visitante.

El backend actual no implementa todavía esa visita compartida. Diseñar su relación/autorización y pruebas antes de habilitarla; no ampliar RLS ni fabricar membresías para hacerla visible. En el escenario aislado las visitas pueden simularse explícitamente sin afirmar integración real.

## 3. Carga sensible: alcance simple

Reutilizar categorías, requisitos, equipo requerido/preferido y rangos de temperatura ya existentes. No añadir una segunda clasificación incompatible. La UI puede agruparlos como carga general/alimentos y conservación ambiente/refrigerada/congelada, más requisitos independientes como fragilidad.

Datos mínimos para decidir:

- Descripción/categoría y embalaje.
- Peso/volumen y unidades, con los límites básicos que ya valida el backend.
- Conservación requerida y rango de temperatura cuando corresponda, declarado por Cliente o fuente del producto; no deducirlo de la palabra «comida» ni fijar temperaturas universales.
- Ventanas/deadline y, si el producto lo necesita, duración máxima admisible declarada. El campo/contrato nuevo debe acordarse con Jean; no sustituirlo silenciosamente por duración de conducción.
- Manipulación especial necesaria, sin incorporar ahora normativa avanzada de todas las mercancías o vías.

Un camión refrigerado solo cumple si su capacidad/evidencia cubre el rango requerido. La cadena incluye recogida, espera, carga, transporte, transferencia y entrega cuando esas fases participan. Un muelle, almacén o tramo sin conservación conocida mantiene la factibilidad pendiente. No se exige frío a una operación donde el embalaje/evidencia acredite otra solución compatible.

Conservar la precedencia: incumplimiento conocido -> ineligible; información necesaria ausente -> unknown; requisitos verificados -> eligible dentro del alcance evaluado. No simular telemetría real de temperatura.

## 4. Ejemplo Amazonas → Lima y modos

Primero concretar localidad/punto de recogida; «Amazonas» es insuficiente para calcular puerta a puerta. Chachapoyas es una referencia del escenario, no cobertura completa de la región.

La selección compara planes conocidos, no «avión siempre mejor para comida»:

1. Comprobar servicio/cobertura y requisitos de carga.
2. Calcular recogida/reposicionamiento, carga/espera, transporte y entrega con tiempos conocidos.
3. Verificar conservación y deadline en el conjunto.
4. Comparar costo/tiempo únicamente entre planes elegibles y ofertas atribuibles.

Para un futuro ROAD→AIR→ROAD, incluir acceso al aeropuerto, disponibilidad del vuelo/cupo, corte de recepción, manipulación/almacenamiento, recogida en destino y última milla. Comparar solo tiempo de vuelo con tiempo de camión produciría una recomendación engañosa.

**Corte propuesto ahora:** ROAD funcional con carga sensible básica. Si ROAD incumple tiempo/temperatura, mostrar la causa y que hace falta otra alternativa. AIR aparece como capacidad pendiente de configuración/revisión, nunca como cotización, cupo o recomendación confirmados. Un corte AIR posterior necesita servicio real/simulado identificado, cupos, horarios, nodos, adaptador y pruebas; no obliga a modelar una flota de aviones.

Fuente de contexto: IATA describe el transporte de perecederos como un problema de tiempo, temperatura, embalaje y manipulación a lo largo de la cadena: https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/how-to-ship-perishable-goods-by-air/ . No se adoptan automáticamente sus rangos/reglas como una política de producto.

## 5. Universo de prueba propuesto

| Carrier | Zonas/conexiones del escenario | Vehículos | Sedes |
| --- | --- | ---: | ---: |
| C01 | Zonas seleccionadas de Lima | 6 | 1 |
| C02 | Zonas seleccionadas de Arequipa | 6 | 1 |
| C03 | Piura, Sullana y Paita | 6 | 1 |
| C04 | Chachapoyas–Chiclayo–Lima | 10 | 2 |
| C05 | Lima–Trujillo–Piura | 10 | 2 |
| C06 | Tacna–Arica; condiciones fronterizas explícitas | 8 | 2 |
| C07 | Santiago–Valparaíso | 8 | 2 |
| C08 | Santiago–Rancagua | 8 | 1 |
| C09 | Madrid–Zaragoza–Barcelona | 10 | 2 |
| C10 | Tokio–Yokohama–Chiba | 8 | 2 |
| Total | Cuatro países, cobertura parcial | 80 | 16 |

Estas conexiones son propuestas de catálogo QA, no geometrías de carreteras ni rutas certificadas. Declarar recojo/entrega, dirección y exclusiones por servicio; no completar sentidos inversos ni países enteros por inferencia. Mantener países separados salvo conexiones explícitas soportadas.

Conductores con identidades sintéticas y agenda coherente; no unirlos permanentemente 1:1 a vehículos. Separar condiciones de activos, ventanas, licencias/habilitaciones QA y datos desconocidos. Usar los modelos/imágenes existentes por tipo.

Ejemplo de distribución de presencia del escenario: 48 en sedes, 28 en ruta y 4 con ubicación desconocida. Entre los 48 presentes: 28 estacionados, 8 esperando, 6 cargando y 6 descargando. Ocho de los estacionados pueden estar en mantenimiento; mantenimiento es una condición/actividad y no suma ocho vehículos adicionales. De los 28 en ruta: 16 hacia recogida y 12 hacia entrega. Las llegadas previstas son una vista de esos viajes, no vehículos adicionales.

El seed vive separado de migraciones, con IDs/namespace estables, reloj de escenario parametrizable, verificación y limpieza limitada al propio escenario. Prepararlo y ejecutarlo primero en una base aislada. No cargarlo en Supabase alojado con la autorización de una migración estructural anterior.

## 6. Orden y reparto de trabajo

| Paso | Backend/escenario de este chat | Frontend que puede avanzar |
| --- | --- | --- |
| 1 | Cerrar manifiesto de carriers, servicios, zonas y conexiones | Services / Coverage / Connections con datos del mismo contrato |
| 2 | Definir presencia/visita y relación con viajes; mínimos de autorización | Sede: Present / Expected arrivals / Departures / Unknown; lista accesible |
| 3 | Reutilizar requisitos de conservación; acordar datos nuevos con Jean | Ficha: tipo de carga, conservación, compatibilidad y datos pendientes |
| 4 | Generador y verificaciones de 10/80/80/16 | Directorios y filtros por Carrier/sede/servicio/equipo; distinguir modo de datos |
| 5 | Probar selección sobre red dirigida y límites de búsqueda | Routes: alternativas, motivos, mapa y estado de factibilidad por separado |
| 6 | Conectar evaluación operativa y después comercial | Vehículo/conductor/citas; Orders y pipeline con referencias persistidas |
| 7 | Coordinador de escenas fuera del canvas, cuando estén definidos los eventos | Sede y Ruta conservan assetId/viaje; modelos existentes; sin reinicios al navegar |

Jean mantiene pedido, ventanas/flexibilidad, proyección mínima/versionada C6 y sus contratos C1–C5. Este chat publica catálogo/capacidades Carrier y las comprobaciones operativas; el frontend no recrea discovery ni cotizaciones. La coordinación de C3 consume fuentes autorizadas y no fabrica una identidad Carrier desde una sesión Cliente.

Toda UI nueva en inglés. Los mocks temporales se identifican como escenario y conservan el contrato esperado; no hacer fallback desde una lectura conectada fallida a ejemplos.

## 7. Rutas y vectores

Primero se publican áreas y conexiones comerciales; después se calcula el recorrido vial entre puntos precisos. Un polígono de cobertura no es una ruta y una línea entre ciudades no es una carretera.

El laboratorio Google actual compara alternativas recibidas; el planificador comercial usa corredores publicados. Mantener sus alcances separados y verificar fuentes/fechas. La clave de Maps del navegador está presente; la clave privada de Routes falta en la configuración revisada. No generar trazados manuales para ocultar ese bloqueo ni almacenar geometría del proveedor sin comprobar las condiciones aplicables.

## 8. Criterios para comenzar la siguiente fase

- Manifiesto QA aprobado, sin listas fijas dentro del dominio.
- Sede cuenta solo presencia declarada; esperados/visitantes separados, ubicación desconocida visible.
- Un vehículo no está físicamente en dos sedes; estacionado no significa libre y mantenimiento bloquea su uso.
- Compatibilidad de conservación y tiempo explicable; falta de datos no produce una recomendación confirmada.
- Simulación reproduce estados sin crear ofertas, bookings ni evidencia live.
- Cobertura negativa, lane inversa inexistente, recurso ocupado, carga fría incompatible, espera que incumple deadline, visitante sin permiso y modo AIR sin datos tienen resultados explícitos.
- Las migraciones nuevas y la aplicación remota se aprueban por su alcance concreto. Las pendientes de sedes/comercial continúan separadas de este plan.

**Este documento no inicia la implementación.** El primer corte propuesto es cerrar y materializar el manifiesto de cobertura y el escenario; el frontend puede preparar sus pantallas en paralelo sobre estos contratos.
