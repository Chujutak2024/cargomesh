# CargoMesh: revisión del contrato, dashboard e intake

Fecha: 1 de septiembre de 2026.

## 1. Dictamen

**Tu observación principal es correcta: la experiencia inicial todavía funciona como una demostración visual alrededor de una solicitud preparada, no como un flujo completo para que una organización cree y gestione sus propias cargas.** No se resuelve solamente reduciendo textos o agregando animaciones de un agente.

El núcleo de orquestación no existe solo en papel: hay conexiones desde acciones de la UI hacia navegación WebMCP, consultas a providers, persistencia de resultados, ranking, booking y recuperación. **Eso no acredita una experiencia completa para el usuario.** El dashboard y parte del intake siguen alimentándose de fixtures, la demostración provider está limitada y varias capacidades no se reflejan de forma accesible o continua en las pantallas.

El maestro contiene una base coherente para solucionar esto: organización como tenant, perfiles logísticos, entrada estructurada, normalización, confirmación humana y estados comerciales separados. **No puedo dar por cumplido todo ese contrato con la UI actual.** Tampoco todas las ampliaciones propuestas son requisitos pendientes del MVP: GPS real y varias estrategias de optimización quedaron expresamente fuera del P0.

**Aclaración incorporada tras la revisión del usuario:** combinar recomendaciones con WebMCP durante la creación de la carga es parte central de la experiencia deseada, no un adorno opcional. El algoritmo puede proponer reutilizar una orden anterior, el agente invoca esa capacidad mediante WebMCP y el usuario revisa un modal antes de aplicar campos. Las secciones 5 y 7 del maestro respaldan el enriquecimiento con contexto e historial, aunque no especifican todavía todos los contratos de esas tools y su interfaz. La versión inicial de este informe subestimaba esa intención.

También se incorpora como objetivo un mapa geográficamente reconocible, con camiones y seguimiento **simulados de forma explícita y coherente**, para demostrar transporte nacional e internacional. Esto no equivale a prometer GPS real ni a adquirir telemetría de transportistas externos.

### Alcance y límites de esta revisión

- Contraste de las seis capturas con las secciones pertinentes del maestro `CargoMesh_Planeacion_WebMCP_FINAL.md`, el checklist y el código de `origin/main` en `17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7`.
- Revisión de código y contratos; no se ejecutó una nueva corrida autenticada contra producción ni se certificó que ese SHA sea el despliegue de cada captura.
- La ampliación revisa acciones de UI, adaptadores, runner, fixtures provider, booking y polling en el mismo SHA. Los hallazgos descritos como límites de código no se presentan como nuevas reproducciones E2E en navegador. No se ejecutaron nuevas suites funcionales para esta actualización documental.
- PR #35 se considera una corrección separada, todavía no integrada en ese `main`; su alcance es resolver y leer una solicitud existente.
- No es una certificación exhaustiva de las más de seis mil líneas del maestro ni de todos sus acceptance tests.
- La auditoría original solo generó este informe. La revisión posterior de planificación autoriza actualizar/publicar el checklist y los handoffs; no modifica código funcional, migraciones ni datos remotos.

## 2. Feedback sobre tus once puntos

### 1. El usuario entra

**Correcto, pero autenticarse no basta para personalizar la aplicación.** El dashboard exige acceso autenticado; después sigue consumiendo datos de demostración. Además, el shell muestra literalmente `Carlos Mendoza`, `Administrador` y `ACME Mining Perú`.

La identidad visible debe venir de la sesión y la membresía autorizada. Una identidad ficticia en pantalla no demuestra por sí sola una fuga entre organizaciones, pero sí representa incorrectamente quién está operando.

### 2. Dashboard relacionado con el usuario y métricas realistas

**De acuerdo con el diagnóstico; ajustaría el criterio de pertenencia.** El maestro establece aislamiento por organización activa y permisos del miembro, no necesariamente mostrar solo filas creadas por su UUID. Un supervisor puede necesitar ver todas las solicitudes de su organización. “Mis solicitudes” puede ser un filtro adicional.

En el código actual, cargas activas, vehículos, SLA y tendencias provienen de fixtures o literales. Por ejemplo, `+12% esta semana`, `97.4%` y la fecha del encabezado no son cálculos operativos de la sesión. La captura muestra “Vehículos disponibles”, no un conteo de carriers, pero tu objeción de fondo aplica: CargoMesh no puede asumir conocer toda la disponibilidad de una flota externa.

Propuesta: conservar pocos indicadores verificables —solicitudes que requieren acción, reservas pendientes de confirmación y envíos en tránsito— y una lista principal de solicitudes. Cada cifra debe derivarse de registros autorizados; sin historial suficiente, mostrar “Sin datos”, no un porcentaje inventado.

Contar providers registrados tampoco equivale a capacidad disponible. La capacidad de una solicitud concreta se confirma consultando al provider.

### 3. Red operativa y mapa

**La crítica sobre su carácter ilustrativo es correcta.** Hay un matiz técnico: el componente sí utiliza SVG, con rutas fijas y posiciones porcentuales. El problema no es usar SVG, sino mostrarlo como seguimiento real con velocidad y actualización reciente provenientes de fixtures.

El maestro excluye GPS en tiempo real y posterga mapas avanzados. La intención aclarada por el usuario es distinta: **mapa geográficamente correcto y movimiento simulado**, no GPS real. Se propone mostrar origen, destino, recorrido y frontera cuando corresponda, con una línea de tiempo de eventos y etiqueta permanente “Seguimiento simulado”. Si el trazado no procede de una ruta vial calculada, debe identificarse como aproximado.

El camión debe corresponder a una reserva y un carrier concretos. Su avance debe concordar con un escenario provider reproducible y con los eventos reportados/persistidos, no con una animación independiente que indique entrega cuando el booking sigue pendiente. La interpolación visual entre posiciones es una representación, no una medición GPS.

### 4. Flota, carrier, entrega, ubicación y conductor

**Coincido en cambiar el foco desde el vehículo hacia el envío.** Para el cliente importan la solicitud, el carrier elegido, el estado confirmado, la fecha estimada y la última información reportada.

Una corrección a tu observación: el conductor sí aparece en las capturas y en `vehicle-status-panel.tsx`; se muestran, por ejemplo, Diego Salazar y María Quispe. Lo pendiente es su procedencia y relación con una reserva real. Los contratos de estado revisados no aportan un conductor como dato garantizado: no debemos inventarlo ni hacerlo obligatorio si el provider no lo expone.

Se conserva el camión como parte necesaria de la experiencia de seguimiento solicitada, vinculado al envío y al carrier; su identificador técnico puede quedar en el detalle. País y ciudad/región deben distinguirse. Antes de tener una reserva confirmada, no se debe presentar una unidad como si ya estuviera transportando esa carga. Datos de conductor/vehículo simulados son admisibles en el escenario demo si su procedencia está explícita y el contrato los soporta.

### 5. Cargas recientes y capacidad logística

**La redundancia existe, pero conservaría las solicitudes como vista principal y reduciría la flota.** Una fila por solicitud, con acceso a detalle o modal, representa mejor el producto que dos listas desconectadas de vehículos y cargas.

Hay una inconsistencia concreta en los fixtures: FR-1042 figura pendiente, asociada a TR-204, mientras ese vehículo se presenta en ruta. Esa combinación no comunica correctamente la separación entre solicitud, selección, reserva y confirmación.

Los porcentajes de centros logísticos y andenes también son fixtures. Sin una fuente y una decisión de producto que justifiquen esa información, conviene retirarlos de la vista operativa. Esto no requiere borrar sus tablas ni iniciar una limpieza de base de datos.

### 6. Resumen completo desde el paso 1

**Tu objeción es parcialmente correcta.** El maestro permite y pide prellenar desde un perfil habitual: no es necesario que todo empiece vacío. Sin embargo, debe distinguirse entre una sugerencia, una edición sin guardar y una solicitud persistida.

Actualmente `/freight-request/new` instancia `createFreightIntakeFixture()`, que ya contiene FR-1042, ruta, peso y presupuesto. No se está generando ese resumen a partir de una selección real del perfil de la organización.

Comportamiento propuesto:

- Sin perfil aplicado: “Por completar” en los campos desconocidos.
- Con perfil: “Sugerido por tu perfil”, permitiendo aceptar o editar.
- Con cambios locales: “Borrador sin guardar”.
- Después de guardar: identificación real y valores persistidos.

El resumen puede actualizarse al editar; lo que no debe hacer es presentar valores de ejemplo como decisiones ya tomadas o como una solicitud nueva guardada.

### 7. Ruta, direcciones, contactos y sugerencias

**La limitación de los campos está confirmada.** El maestro ya exige país, ciudad y dirección, además de nombre y teléfono separados para recojo y entrega; incluye empresa receptora. La UI los comprime en textos de origen/destino y un único campo por contacto.

Tu jerarquía geográfica es una buena ampliación, pero no impondría simultáneamente `State` y `Department` en todos los países. Conviene un modelo adaptable: país, región/departamento/estado, provincia o localidad cuando corresponda, dirección y código postal opcional según el país. El catálogo de contactos seleccionables necesita una fuente autorizada; separar nombre y teléfono es una corrección más inmediata.

La asistencia debe intervenir durante el borrador: buscar una orden similar, proponer direcciones/contactos reutilizables y explicar su origen. El agente debe poder invocar esa capacidad mediante WebMCP y presentar cambios revisables. No hace falta consultar por cada pulsación ni anunciar disponibilidad antes de ejecutar las tools de cobertura/capacidad.

### 8. Paso fronterizo asistido por WebMCP

**Es una oportunidad válida, no una capacidad ya implementada.** Actualmente es un texto editable que no participa en los inputs enviados por este formulario al runner.

Los contratos del provider ya contemplan soporte transfronterizo, coordinación aduanera, documentos requeridos y notas fronterizas. Podemos presentar esa información después de consultar al carrier, sin inventar otra tool de inmediato.

Una sugerencia previa desde un catálogo puede ser útil, pero debe diferenciarse de una condición aceptada por el provider. Automatizar planificación fronteriza o consultar nuevas fuentes exigiría ampliar el contrato. CargoMesh no debe presentar una sugerencia como autorización aduanera ni como garantía de cruce.

### 9. Categoría y recomendaciones de carga

**Este es uno de los hallazgos más importantes y está respaldado por código.** La base tiene orientación de categorías: métodos recomendados, campos específicos, requisitos sugeridos y clases de vehículo candidatas. El formulario no consume esa configuración.

Además:

- Cambiar “Perfil habitual” solo cambia un texto; no carga ni aplica otro perfil.
- Editar “Categoría” cambia el nombre visible, pero conserva `cargoCategoryCode`, que en el fixture es `MACHINERY`. Las tools reciben ese código aunque la pantalla diga otra categoría.
- “Maquinaria” aparece como método de ingreso, mezclando qué se transporta con cómo se cuenta.
- La normalización actual cubre cantidad por peso/dimensiones, pero no representa el factor `units_per_entry` del maestro ni una entrada diferenciada `TOTAL_WEIGHT`.

La recomendación puede calcularse con un algoritmo determinista y transparente: perfil, categoría, similitud de ruta/carga y antigüedad del antecedente. Su consulta mediante WebMCP, explicación y aplicación controlada forman parte del flujo objetivo. No hace falta que un modelo invente los cálculos para que la colaboración usuario–agente sea auténtica.

### 10. Fechas, estrategia y asistencia en programación

**Las fechas están deliberadamente bloqueadas, pero eso no completa el producto que promete la pantalla.** Se hizo para consultar una solicitud ya persistida y evitar que los timestamps del navegador divergieran del backend durante la demostración.

Para una verdadera “Nueva solicitud”, el usuario debe definir ASAP o una ventana futura, guardar los valores y confirmar esa misma versión antes de consultar providers. Hay que validar zona horaria, orden de fechas y coherencia de la ventana en el servidor. Quitar `readOnly` sin persistencia repetiría el problema anterior.

**BALANCED fijo no es un incumplimiento del P0:** el maestro reserva Lowest Cost, Most Reliable, Fastest y Custom para P1. Podemos explicarlo como “Equilibrada” y no mostrar un selector inoperante. Para habilitar otras estrategias se necesita soporte real de evaluación, no solo opciones visuales.

Hay otra brecha: el presupuesto sí se puede editar y aparece modificado en la revisión, pero este flujo no guarda ese cambio en el FreightRequest. No debe sugerir que el ranking usará un presupuesto nuevo si el backend conserva el anterior.

### 11. Evaluación general

**Sí hay problemas funcionales, además de UX.** El defecto central es la falta de continuidad entre lo que el usuario edita, lo que se guarda y lo que finalmente se evalúa.

No basta añadir más paneles o un indicador “MCP pensando”. La mejora central es que una persona pueda preparar una carga distinta del ejemplo con asistencia real, confirmar sus datos, obtener resultados consistentes y encontrar después esa misma solicitud y su seguimiento en su organización.

## 3. La brecha más seria: editar no significa guardar

El recorrido actual de `FreightIntakeForm.submit()` es:

1. Consultar el execution intent de un UUID que ya existe.
2. Iniciar la orquestación para ese UUID.
3. Construir parte de los inputs provider con el estado local del formulario.
4. Navegar al resultado de la evaluación.

No hay en ese recorrido una escritura de creación/actualización de la solicitud con las ediciones del usuario. `start_orchestration_run` recibe la identificación y la clave de idempotencia; lee la solicitud existente y obtiene candidatos desde ella.

Por tanto, cambiar ruta, carga o presupuesto puede producir divergencias entre pantalla, inputs provider y solicitud utilizada por discovery/ranking. Contactos y paso fronterizo tampoco se guardan mediante este submit. Es un riesgo de consistencia identificado en código; no afirmo haber reproducido cada variante contra producción en esta auditoría.

El error de referencia de FR-1042 y esta brecha son problemas distintos. **PR #35 ayuda a obtener el registro correcto, pero no implementa crear/editar una nueva solicitud ni un dashboard conectado.** No debe presentarse su integración como solución completa a tus observaciones.

## 4. Qué papel debe tener WebMCP

WebMCP permite exponer herramientas de la aplicación para que un agente las descubra e invoque. No genera por sí mismo recomendaciones ni decide qué debe sugerirse en cada pantalla. El maestro también distingue herramientas, agente y motor de ranking. [Especificación WebMCP](https://webmachinelearning.github.io/webmcp/).

Separación recomendada:

| Responsabilidad | Fuente o ejecutor |
|---|---|
| Identidad, organización, perfiles y preferencias | Backend autorizado y datos de la organización |
| Totales y validación del borrador | Reglas deterministas; validación definitiva server-side |
| Sugerencias y explicación de faltantes | Algoritmo sobre perfil/catálogos/historial autorizado, expuesto como capacidad consultable mediante WebMCP |
| Cobertura, capacidad y cotización | Tools del provider mediante WebMCP |
| Ranking | Ofertas persistidas y política soportada |
| Selección y autorización | Confirmación humana y controles server-side |
| Booking y seguimiento | Tools provider y Booking Bridge; UI desde estado persistido |

Una explicación visible del tipo “Se sugieren estas dimensiones por tu perfil; la capacidad todavía no está verificada” es más honesta y útil que un indicador genérico “MCP pensando”. La UI examinada no implementa esa asistencia contextual; eso no invalida las tools que sí utiliza posteriormente.

### 4.1 Recomendación, modal y aplicación al borrador

Recorrido acordado como intención de producto:

1. El usuario aporta datos mínimos de la nueva carga.
2. El agente invoca una tool de CargoMesh para consultar sugerencias basadas en perfiles u órdenes anteriores autorizadas.
3. El algoritmo devuelve la fuente, motivo de coincidencia, campos propuestos, datos faltantes y advertencias. Si no encuentra un antecedente útil, debe decirlo.
4. La interfaz ofrece “Encontramos una solicitud similar”. Al revisar, un modal compara valores actuales y propuestos y permite elegir qué reutilizar.
5. “Aplicar seleccionados” modifica el borrador; el usuario puede editar o deshacer. Rechazar/cerrar no altera nada.
6. El servidor valida y persiste; la evaluación de providers ocurre sobre la versión confirmada.

Ejemplo de copy: “Puedes reutilizar la dirección de entrega, el contacto y las características de carga. Las fechas, el precio y la disponibilidad deben validarse nuevamente”.

La consulta de sugerencias no debe escribir reservas ni alterar la solicitud. Si la aplicación de cambios también se expone como tool, necesita un contrato separado de escritura y comprobación de la aceptación del usuario; la invocación del agente no constituye por sí sola consentimiento. No sobrescribir ediciones recientes ni copiar autorizaciones, claves de idempotencia, reservas o precios vigentes de una orden antigua.

Estas son nuevas capacidades de CargoMesh, no funcionalidades ya existentes dentro de las cinco tools provider. Una llamada API convencional con un modal no demuestra esta integración WebMCP: deben poder observarse descubrimiento/invocación y resultado. Los nombres y esquemas definitivos de las nuevas tools quedan por acordar.

### 4.2 Implementado en código no significa disponible como producto

Para evaluar cada capacidad hay que comprobar cinco cosas: existe su implementación, es invocable en el navegador compatible, la acción normal del usuario la alcanza, opera sobre sus datos confirmados y el resultado se refleja de manera comprensible y recuperable.

| Capacidad | Conexión comprobada en el código | Qué falta o limita la experiencia del usuario |
|---|---|---|
| Recomendar reutilizar una orden | No se encontró este recorrido en el intake revisado | Tool, algoritmo conectado, propuesta visible, aceptación y persistencia |
| Aplicar una recomendación | El formulario solo permite cambios locales; el selector de perfil cambia su etiqueta | Cambios seleccionables, protección de ediciones, guardado y recarga |
| `check_service_coverage` | El submit alcanza el runner y este ejecuta la tool mediante el adaptador WebMCP | No recomienda durante el paso Ruta; cobertura atada al catálogo fixture y al problema de consistencia del intake |
| `check_capacity` | Se ejecuta después de cobertura dentro del recorrido provider | No ayuda mientras se define carga/agenda; fechas bloqueadas y código de categoría desalineable restringen la demostración |
| `quote_freight` | Resultado enviado al Result Bridge; el dispatch real lee ofertas y muestra precio, tránsito, elegibilidad y razones | Tarifas/tiempos de los servicios demo prefijados; no demuestra cotización general para cualquier orden |
| `book_freight` | Seleccionar una oferta real llama `prepare`, ejecuta la tool y registra el resultado antes de abrir la reserva | Depende de llegar al dispatch real, del navegador compatible y del provider configurado; no basta visitar una pantalla fixture |
| `get_provider_booking_status` | Pantalla de reserva consulta la tool, registra estado y vuelve a leer el BookingViewModel | Polling solo mientras espera confirmación y con contexto local; no completa seguimiento continuo hasta entrega |
| Recovery | UI filtra `recoveryOfferIds`, prepara y reserva otra oferta | Las alternativas y metadata de navegación dependen también del contexto conservado en la pestaña |
| Mapa/camiones del dashboard | Props procedentes de fixtures visuales | No están conectados a las ejecuciones ni al booking real; animarlos no resolvería esa desconexión |

**Dictamen:** no es correcto afirmar que todas las tools funcionan únicamente en papel; sí hay conexiones funcionales en la UI. Tampoco es correcto marcarlas como experiencia terminada solo por existir esas conexiones. Hay funciones ausentes, otras parciales y otras demostradas únicamente bajo condiciones controladas.

### 4.3 Hallazgos adicionales de la trazabilidad UI → tool → resultado

**A. La evaluación ocurre antes de mostrar su progreso.** El submit espera a que termine `runInt02aOrchestration` y después navega al dispatch. El runner recopila las respuestas provider antes de enviarlas al bridge y evaluar. Aunque existe una pantalla de progreso, ese recorrido normal deja al usuario mirando “Evaluando providers…” y un iframe oculto durante las consultas; el detalle llega después. Falta exponer progreso veraz mientras sucede, sin porcentajes ni eventos inventados.

**B. La cotización demo sí contiene valores prefijados.** `quote-freight-tool.ts` define overrides para los tres servicios del Golden Flow: desglose de precio, tránsito y disponibilidad. Hay validaciones de capacidad y fechas derivadas del input, y existe una fórmula genérica para otros códigos; no es una función completamente ajena al input. Pero cambiar el peso dentro del límite no cambia necesariamente la tarifa prefijada de esos servicios. Esto sirve para regresión determinista; no prueba adaptación comercial general ni es, por sí solo, un fallo del protocolo WebMCP.

**C. Nacional e internacional aún no están demostrados por el mismo contrato operativo.** Los fixtures de capacidades revisados cubren el corredor Perú–Chile y maquinaria. Además, `check_service_coverage` incluye `supportsCrossBorder` como requisito incondicional de `supported`: un servicio exclusivamente nacional con ese flag falso sería rechazado. Por tanto, no basta añadir un mapa nacional: A debe revisar la condición según el tipo de operación y ofrecer escenarios provider compatibles. El matching actual por aliases tampoco es una validación geográfica de direcciones completas.

**D. Confirmación no equivale a tracking continuo.** `shouldPollProviderBooking` retorna verdadero solo para `PENDING_PROVIDER_CONFIRMATION`; después de `CONFIRMED` se detienen el polling y la acción de refresh que usa esa condición. La tool de estado revisada aplica los controles `ACCEPT`/`REJECT`, pero no genera por sí sola una ruta de movimiento progresivo. Que los tipos contemplen tránsito/entrega no demuestra que el usuario recorra esos estados. El nuevo simulador debe producirlos y la UI debe poder observarlos sin saltarse el bridge.

**E. Retomar una reserva en otro contexto de navegador es incompleto.** `BookingStatusClient` recupera el contexto de navegación/ofertas desde `sessionStorage`. Sin esa entrada, aún puede leer el BookingViewModel persistido, pero no inicia polling WebMCP, no ofrece la misma acción de actualización y `recoveryOffersFor` devuelve una lista vacía. Las secciones Tool/Navegación del drawer también dependen de esa evidencia local. Una apertura con sesión válida pero sin ese almacenamiento necesita reconstrucción autorizada del contexto; no debe depender exclusivamente de haber seguido el flujo en la misma pestaña.

**F. Existen recorridos visuales explícitos separados del real.** Con un `?scenario=` reconocido, dispatch y booking renderizan fixtures. Sin él, leen APIs reales; no encontré en esas páginas una sustitución automática por ofertas fixture ante un error. Las capturas de escenarios sirven para UX, no como prueba de WebMCP. En cambio, el dashboard y la inicialización del intake sí cargan fixtures en su recorrido habitual: no deben agruparse todos bajo una misma afirmación.

**G. La compatibilidad es una precondición real.** El adaptador exige `document.modelContext` y las tools autorizadas; si faltan, produce un error. Poder abrir la web y autenticarse no garantiza poder ejecutar WebMCP. La interfaz debe comprobar y explicar ese requisito antes de que el usuario complete la orden, sin sustituirlo silenciosamente por handlers o resultados simulados.

Estos hallazgos se basan en ramas de código identificables; las pruebas de usuario propuestas en §7 deben confirmar su comportamiento en el SHA desplegado. No se atribuye un error específico al navegador de la captura sin comprobarlo.

### 4.4 Simular datos no debe simular falsamente la ejecución

Hay que distinguir tres situaciones:

- **Fixture provider válido:** un transportista simulado responde realmente a una tool; el resultado se registra y afecta decisiones reales del demo. Es compatible con el maestro.
- **Fixture visual válido:** una pantalla de regresión muestra datos de ejemplo explícitos, sin atribuirlos a una corrida.
- **Brecha de producto:** la pantalla normal muestra datos prefijados sin relación con la orden del usuario, o una capacidad existente no es alcanzable/observable desde el flujo normal.

Para la nueva experiencia, la simulación debe conservar causalidad: orden confirmada → consulta → oferta → selección → booking → eventos → mapa. Debe poder variar de forma controlada para casos nacional/internacional y cambios de carga, no mantener una presentación idéntica ante cualquier pedido.

## 5. Flujo objetivo: nueva carga asistida y seguimiento demostrable

1. Sesión válida y contexto de organización autorizado; identidad real en el shell.
2. Dashboard con solicitudes reales y estado vacío cuando corresponda.
3. Nuevo borrador sin reutilizar automáticamente FR-1042.
4. Recomendación de perfil/orden anterior consultada por el agente mediante WebMCP, con modal revisable y aplicación opcional de campos.
5. Ruta/contactos estructurados; categoría y método coherentes; totales canónicos.
6. Programación editable y presupuesto; BALANCED como política P0 explícita.
7. Guardado y confirmación server-side de una versión coherente. El contrato debe definir cómo invalidar una evaluación previa si la solicitud cambia.
8. Discovery y ejecución WebMCP sobre esa versión confirmada.
9. Ofertas, explicación del ranking y selección ASSISTED sin autoselección.
10. Booking, confirmación, replay/recovery y detalle con eventos persistidos, recuperable sin depender de una pestaña específica.
11. Mapa geográfico y camión del envío, con avance simulado reproducible, eventos coherentes y diferencias entre recorrido nacional e internacional.

Para la demo preconfigurada puede seguir existiendo un recorrido de solicitud preparada, pero debe identificarse como tal y separarse del flujo de creación. El esquema de borrador/confirmación debe acordarse con los estados existentes antes de implementar endpoints nuevos.

La reducción de esfuerzo es una condición de aceptación: mostrar solo campos pertinentes, reutilizar datos con aprobación, no preguntar lo ya conocido y permitir edición humana. Se conserva Auth existente, sin abrir un nuevo proyecto de login.

## 6. Plan reducido a un día — reemplaza la propuesta extensa

El usuario pidió simplificar y publicar la planificación. Se conservan los hallazgos de esta auditoría, pero se sustituyen los siete/once bloques propuestos por cuatro resultados. Este cambio documental no acredita que se hayan implementado.

| Entrega | Resultado | Responsables |
|---|---|---|
| D1-01 | Nueva carga editable, guardada y confirmada; misma versión en evaluación | C backend; B formulario/contrato de presentación |
| D1-02 | Recomendación contextual invocada por WebMCP y aplicada con consentimiento | C algoritmo; A tool/runtime; B modal |
| D1-03 | Seeds/casos nacional, internacional y negativo; dashboard de datos autorizados | A escenarios; C lectura/integración de datos; B dashboard/detalle |
| D1-04 | Recorrido integrado, progreso visible, booking/replay/recovery y reapertura sin dependencia exclusiva de caché | C coordina; A WebMCP; B UX |

B empieza con contratos de presentación, componentes y pruebas, sin esperar a los seeds. C/A/B acuerdan inputs/outputs y errores en el mismo PR; no se abre otra fase extensa de documentación. A puede preparar un paquete seed sobre el schema vigente, revisado por C: no modifica Auth/RLS ni aplica cambios remotos.

PR #35 conserva su alcance de lectura de existente; no se convierte en mega-PR ni obliga a que /new sea permanentemente read-only. Escritura, sugerencias y UI nueva se entregan en cortes separados del PR #35 y de la landing #34.

Mapa: propuesta base con geografía reconocible, ruta demo declarada y eventos. Camión animado solo tras funcionar el flujo principal y con estado provider/bridge coherente. Si no alcanza el día, entregar mapa+timeline y declarar movimiento pendiente; no afirmar tracking continuo. Se posponen GPS real, gestión completa de flota, estrategias nuevas y automatización aduanera.

Fuente operativa única al publicarse: `docs/04-execution/CargoMesh_Team_Execution_Checklist.md` v1.3. Los prompts para A/B/C y alternativas del mapa están en `docs/04-execution/CargoMesh_One_Day_Handoff.md`; este informe conserva el diagnóstico, no un segundo checklist.

## 7. Pruebas que deben demostrar el cierre

- Dos organizaciones no ven solicitudes ni perfiles ajenos; “mis solicitudes” no reemplaza el aislamiento por organización.
- Organización sin solicitudes: estado vacío, sin vehículos, porcentajes o tracking ficticios.
- Sin perfil: campos desconocidos vacíos; con perfil: sugerencias identificadas y modificables.
- Orden anterior similar: el agente invoca la tool de recomendación; la propuesta identifica su fuente y se visualiza antes de aplicar. Sin historial, no inventa antecedentes.
- Aplicar solo campos seleccionados conserva el resto; cancelar no modifica; una sugerencia obsoleta no pisa cambios posteriores. No copia autorización, booking, key o cotización vigente de otra orden.
- Cambiar de categoría actualiza código, campos y requisitos; no conserva `MACHINERY` detrás de otra etiqueta.
- Métodos soportados calculan como el contrato; incluir un caso con `units_per_entry > 1` y otro `TOTAL_WEIGHT`.
- Editar ruta, contactos, carga, presupuesto y fechas; guardar y recargar conserva los mismos datos.
- Confirmación, discovery, inputs WebMCP y ranking usan valores compatibles de la misma solicitud/versionado acordado.
- Fechas inválidas se rechazan; zona horaria visible; sin regenerar silenciosamente fechas comerciales durante evaluación.
- Fallo al cargar datos: mensaje y acción recuperable, sin sustitución silenciosa por fixtures.
- No se presenta transporte en curso antes de su estado correspondiente; ETA, ubicación y conductor ausentes se muestran como no informados.
- La consulta de providers muestra progreso observable durante la ejecución; sin WebMCP disponible se informa el bloqueo, sin fabricar resultados.
- Variar inputs produce efectos justificables: exceso de capacidad, categoría distinta, ventana inviable y falta de cobertura. Las tarifas fijas del escenario se declaran; cualquier simulación de tarifas variables sigue reglas verificables.
- Un servicio nacional no se rechaza únicamente por no soportar cruce fronterizo; el internacional exige sus condiciones. Ambos recorridos se prueban desde la UI.
- Abrir la reserva con sesión válida y sin su entrada de `sessionStorage` permite reconstruir los datos autorizados necesarios para consulta/recovery, sin usar la caché como autorización.
- Tras confirmar, el simulador genera tránsito/entrega según el escenario y la UI sigue observándolo. Mapa y camión corresponden al booking; no aparecen eventos fronterizos en un recorrido nacional.
- Repetir booking y recovery mantiene las garantías de idempotencia y cleanup ya logradas.
- Ejecutar desde sesión limpia con una carga diferente del caso preparado, además de conservar su regresión reproducible.

## 8. Maestro, checklist y documentación

El maestro no debe simplificarse para justificar artificialmente los fixtures. Ya pide varias de las capacidades que faltan: direcciones/contactos estructurados, perfiles, edición humana, coherencia de totales y dashboard de la organización (§2.4 y precondiciones de §32). Las secciones 5 y 7 respaldan además el enriquecimiento con preferencias/historial y la reducción de preguntas: no corresponde relegar toda esa asistencia a una mejora cosmética futura.

Sí conviene aclarar qué corresponde a la demostración de solicitud preparada, qué al producto mínimo general y qué a P1. También separar el vocabulario de sugerencia, borrador, confirmación, selección y reserva en contratos y pantallas.

El checklist consultado marca Día 2 y Día 3 completos, incluyendo B-03/C-03/INT-03, y mantiene REL-01/REL-02 pendientes. Eso documenta integraciones y evidencia del Golden Flow probado; **no demuestra por sí solo que todos los casos de uso del maestro estén implementados**. El despliegue existente tampoco garantiza su aceptación completa.

Estos hallazgos no borran las integraciones del Día 3. Revelan una brecha entre el recorrido técnico ensayado y la experiencia general prometida. Corresponde registrar correcciones verificables y reconciliar la aceptación del intake/dashboard, no afirmar que solo falta documentación ni desmarcar tareas indiscriminadamente. La planificación v1.3 conserva el historial y abre D1-01..04; no acredita nuevas casillas completadas.

Para futuras marcas de cierre conviene separar “implementado”, “conectado a la UI”, “validado en el escenario controlado” y “aceptado en el flujo de usuario objetivo”. El nombre de una tool en una tabla, un test unitario o una captura fixture no bastan para acreditar los cuatro niveles.

Una documentación simple debería permitir reconocer: qué hace el producto, cómo probarlo, qué datos son simulados, qué ejecución/persistencia es real y cuáles son sus límites. No necesita prometer GPS, flota propia o recomendaciones inexistentes para resultar convincente.

## 9. Fuentes del repositorio

Enlaces fijados al SHA auditado para evitar confundir cambios posteriores con esta revisión:

- [Maestro: intake, perfiles y normalización (§2.4)](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md#L404).
- [Maestro: preferencias e historial (§5)](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md#L1264) y [enriquecimiento de solicitudes (§7)](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md#L1661).
- [Maestro: BALANCED P0 y estrategias P1 (§9)](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md#L1878).
- [Maestro: Home (§21.3)](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md#L4679), [exclusiones (§24)](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md#L5206) y [aceptación (§32)](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/00-master/CargoMesh_Planeacion_WebMCP_FINAL.md#L5805).
- [Dashboard: guard y alimentación con fixtures](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/app/%28cargomesh%29/dashboard/page.tsx).
- [Nueva solicitud: inicialización con fixture](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/app/%28cargomesh%29/freight-request/new/page.tsx).
- [Formulario: edición, resumen y submit](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/components/freight-intake-form.tsx) y [construcción de inputs provider](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/freight-ui/int02a-client.ts).
- [Inicio de orquestación sobre una solicitud existente](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/orchestration/start-run.ts).
- [Fixtures de dashboard e intake](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/freight-ui/ui-fixtures.ts), [mapa SVG](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/components/live-tracking-map.tsx) y [panel de vehículos](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/components/vehicle-status-panel.tsx).
- [Catálogo de orientación de carga](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/supabase/migrations/20260829011002_add_cargo_category_intake_guidance.sql).
- [Runner: recolección, bridge y evaluación](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/webmcp-runner/orchestration-runner.ts) y [adaptador `document.modelContext`](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/webmcp-runner/external-provider-navigation-adapter.ts).
- [Dispatch real y selección](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/components/dispatch-view.tsx), [cliente de booking/contexto local](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/freight-ui/booking-client.ts) y [UI de estado/polling](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/components/booking-status-client.tsx).
- [Cobertura provider](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/providers/check-service-coverage-tool.ts), [fixtures de capacidades](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/providers/provider-capability-fixtures.ts), [cotización y overrides](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/providers/quote-freight-tool.ts) y [consulta/transición provider](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/frontend/src/features/providers/get-provider-booking-status-tool.ts).
- [Checklist principal](https://github.com/Chujutak2024/cargomesh/blob/17e3c0ea3a9201dc640ebcef4be66cfa5ca1c6b7/docs/04-execution/CargoMesh_Team_Execution_Checklist.md) y [PR #35, corrección separada de lectura del intake](https://github.com/Chujutak2024/cargomesh/pull/35).

**Conclusión actualizada:** el núcleo técnico tiene ejecución real bajo condiciones controladas, pero no satisface por completo la experiencia pretendida. El siguiente trabajo no es meramente “pulir UI”: es completar nueva carga editable/persistida, recomendación contextual mediante WebMCP, aplicación humana y seguimiento geográfico simulado coherente. Una capacidad se considera entregada cuando el usuario puede alcanzarla, comprenderla y comprobar su efecto sobre su propia solicitud, no cuando únicamente aparece en código o en documentación.
