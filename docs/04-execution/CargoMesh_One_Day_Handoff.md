# CargoMesh — Encargos de un día para A, B y C

Plan vigente: [checklist v1.3](CargoMesh_Team_Execution_Checklist.md). Esto reemplaza los planes extensos EXP propuestos, no los contratos ejecutables existentes. Los prompts son encargos para los integrantes; este PR es exclusivamente documental.

## Acuerdo mínimo antes de conectar

B puede preparar inmediatamente tipos de presentación, estados y pruebas de UI. C define/valida su correspondencia con las APIs; A valida la frontera WebMCP. Un comentario de PR con ejemplo de request/response, errores y campos editables basta para coordinar. No hace falta abrir otro PR exclusivamente contractual por cada campo.

| Frontera | Quién propone | Qué confirmar |
|---|---|---|
| Borrador y guardado | B desde UX; C desde datos | Campos requeridos/nullable, identidad server-side, versión, confirmación y respuesta canónica |
| Sugerencia | C algoritmo; A tool; B modal | Fuente, motivo, campos propuestos, versión del borrador y selección de campos aceptados |
| Dashboard/detalle | B contrato de presentación; C lectura | Solicitud, estado, carrier, fechas, última actualización, acciones y estado vacío |
| Seguimiento simulado | A escenario; B representación; C persistencia | Relación booking/vehículo/evento, posiciones o ruta cuando existan y reloj/procedencia simulados |

No agregar flags o campos a contratos estrictos existentes por conveniencia de UI. Mantener modelos de presentación separados o acordar y probar una versión compatible. Rutas y nombres de tools nuevas se concretan en el PR de implementación, no se asumen por este documento.

## Prompt para A — seeds útiles y WebMCP observable

> A, continúa el trabajo de seeds que ya te encargué. Tenemos un día y buscamos una demo que cambie correctamente ante pedidos diferentes. Sigue D1-02/D1-03 del checklist v1.3; conserva tu trabajo previo y publica cortes pequeños.
>
> Primero entrega un paquete reproducible sobre el schema actual y un manifest con tres casos: nacional compatible, Perú–Chile compatible y uno sin cobertura o con capacidad insuficiente. Incluye perfiles/antecedentes sintéticos que permitan recomendar reutilizar una orden anterior, más un usuario/contexto sin antecedentes para la prueba negativa. No hace falta generar muchas filas.
>
> Separa catálogo/perfiles/antecedentes de runtime. La NUEVA solicitud se crea desde UI y sus runs, ofertas, decisiones y booking nacen durante la ejecución, nunca precargados por el seed. Los antecedentes sintéticos se identifican como tales y no se presentan como una corrida real. Aísla los nuevos escenarios de las métricas/datos del Golden Flow de regresión para no alterar silenciosamente sus resultados.
>
> Mantén claves estables solo en configuración/seed, relaciones válidas y timestamps desde un reloj base único; futuras ventanas para solicitudes nuevas, fechas pasadas coherentes para antecedentes. Repetir el seed no duplica. No hardcodear IDs nuevos en UI/runner ni nombres de carriers como reglas. El manifest indica datos, resultado esperado, limpieza acotada y limitaciones de cada caso.
>
> Revisa la compatibilidad efectiva de los providers: el caso nacional no debe exigir supportsCrossBorder. Cada servicio tiene capacidades/fixtures coherentes; no declarar compatible todo destino por coincidir con una palabra del país. Comprueba categoría, peso, volumen, ventana y documentos relevantes. Una tarifa fija de escenario debe declararse, no venderse como cotización dinámica general.
>
> En paralelo, acuerda con C/B y expón la consulta del algoritmo de recomendaciones de C mediante WebMCP. A implementa registro/runtime; B monta la integración en su UI. La consulta es read-only, usa autorización server-side y devuelve sugerencias, no reservas. Demuestra getTools/executeTool reales y efecto visible del resultado. Aplicar cambios requiere aceptación del usuario y no copia autorización ni booking antiguo.
>
> Si el flujo principal ya funciona, prepara un escenario de tracking reproducible para que B muestre un camión vinculado al booking. No cambies enums/schemas ni metas coordenadas donde el contrato no las admite sin acordar adaptación con C.
>
> Alcance excepcional autorizado: paquete seed sobre schema vigente, revisado por C. No cambies Auth, RLS, grants, migraciones de esquema, scoring o pantallas B; no apliques datos remotos ni resets compartidos. Entrega comandos locales reales, diff, pruebas de repetición/casos y handoff. No declares simulaciones como evidencia de transportistas reales ni hagas merge por tu cuenta.

## Prompt para B — trabajo nuevo inmediato, contratos y flujo

> B, tu siguiente entrega es D1-01/D1-02/D1-03: nueva carga usable y asistida, no otra ronda de copy del login. Mantén PR #34 solo landing. Trabaja desde main actualizado en una rama nueva; no esperes a los seeds para desarrollar tipos/componentes y pruebas, pero no presentes mocks como integración terminada.
>
> Toma ownership de los contratos de PRESENTACIÓN: borrador editable, sugerencia/modal, resumen de solicitud y detalle de envío. Propón el mínimo de campos, estados vacío/loading/error, validaciones visibles y acciones; en el mismo PR coordina con C su API/autorización y con A la tool. No inventes endpoints operativos ni dupliques lógica de negocio.
>
> /freight-request/new debe iniciar una solicitud nueva: no cargar FR-1042 como identidad por defecto. Permite editar ruta, contactos separados, categoría/código, método, cantidades, fechas y presupuesto. Organización/operador vienen de sesión, totales son derivados y BALANCED se explica como política disponible. Mostrar solo campos pertinentes; conservar TOTAL_WEIGHT y unitsPerEntry según el contrato. Guardar/confirmar y construir las llamadas provider con los datos canónicos que devuelve C.
>
> Implementa el modal de sugerencia con fuente/motivo, comparación de campos y selección de qué aplicar. Cerrar/rechazar no altera; aplicar conserva las ediciones no seleccionadas; no aplica una sugerencia obsoleta sin revisar. El usuario puede seguir sin sugerencia. La consulta del agente pasa por WebMCP de A y el algoritmo real de C, no por un texto fijo presentado como IA.
>
> Simplifica dashboard: solicitudes de la organización, acciones pendientes y detalle accesible. Elimina o desactiva honestamente métricas, identidad, flota y capacidad que no tienen fuente real. Muestra carrier/vehículo solo con relación válida al envío, o dato no informado. No conviertas las pantallas vacías en fixtures silenciosos.
>
> Corrige la visibilidad de ejecución: mostrar progreso real durante las consultas, no solo al terminar. Coordina callbacks/eventos con A/C; no inventes porcentajes. Comprueba WebMCP disponible y comunica el requisito antes de pedir al usuario completar todo. Mantén booking/replay/recovery existentes y coordina con C la reapertura sin contexto local.
>
> Para PR #35: su GET es de lectura, útil para detalle/orden anterior. Su instrucción de bloquear datos es un límite de ESE endpoint, no el diseño permanente de /new. No uses ese GET como API de guardado; integra el contrato de escritura que publique C. Sin él, entrega UI marcada pendiente de integración, no “carga creada”.
>
> Después del flujo guardado, aplica la propuesta de mapa de este documento. Prueba teclado, móvil/escritorio, errores, edición→guardado→recarga, modal aceptar/rechazar, categoría distinta, estado vacío y reapertura. Publica SHA/handoff para A+C. No toques RLS, secretos, scoring, handlers provider ni apliques cambios remotos. No hagas merge por tu cuenta.

## Nuestra parte — C

1. Mantener PR #35 acotado; revisar su base/checks e integrar solo por el flujo de aprobación correspondiente. No reescribirlo como “crear pedido”. La funcionalidad de escritura va en un corte nuevo.
2. Entregar guardado y confirmación de carga: identidad autorizada, campos coherentes, totales canónicos, fechas y presupuesto; resolver edición de solicitud ya evaluada sin mutar snapshots. Reusar schema existente; cualquier cambio necesario va en migración aislada y probada, no oculto en seeds.
3. Implementar recomendación simple sobre antecedentes autorizados y datos de categoría/perfil. No modificar BALANCED; devolver fuente y explicación, sin falsa precisión ni acceso de otra organización.
4. Acordar con B contratos de presentación y entregar lectura del dashboard/detalle; reconstruir desde servidor los datos autorizados para retomar consulta/recovery, sin confiar en sessionStorage como autorización.
5. Revisar el paquete seed de A y probarlo localmente sin tocar el remoto por este encargo. Conservar la regresión del Golden Flow y distinguir historial sintético.
6. Integrar cortes pequeños y ejecutar D1-04 con A/B. Publicar hallazgos y límites; no esperar a que todo esté pulido para probar el flujo.

## Mapa para B

### Opción base — geografía reconocible y estado del envío

- Mapa con países/ciudades reconocibles, origen y destino según el pedido; puede ser cartografía vectorial estática georreferenciada o una librería ya disponible. No investigar múltiples stacks durante el día.
- Para los dos casos demo, una ruta predefinida asociada al escenario; si no es una ruta calculada por carretera, etiquetar “Ruta de demostración aproximada”. No cambiarla solo por un label si las posiciones siguen siendo las mismas.
- Mostrar país y localidad, carrier asignado, última actualización y eventos. Nacional sin frontera; internacional con su cruce representado y eventos correspondientes cuando estén disponibles.
- Datos cartográficos con procedencia/atribución y licencia verificadas. No introducir claves privadas, servicios pagos ni depender de endpoints sin comprobar sus condiciones. B documenta la elección en su PR.

### Opción posterior — camión simulado

- Movimiento con un reloj simulado inyectable y escenario repetible; vinculado a booking y vehículo del provider demo.
- Etiqueta permanente “Seguimiento simulado”; interpolación visual no se presenta como coordenada GPS recibida.
- Confirmación, tránsito y entrega provienen del escenario provider y se registran mediante el bridge. La animación no confirma ni entrega la carga.
- A/C acuerdan consulta después de CONFIRMED, datos de ruta/ubicación y persistencia. Reusar tipos existentes solo si representan la información fielmente; no romper schemas estrictos.
- Si faltan ubicación, ruta o asignación, estado explícito y timeline; no dibujar un camión genérico como si perteneciera a ese envío.

**Límite del día:** primero carga→sugerencia→guardado→tools→booking. Si no queda tiempo, mapa+timeline sin movimiento, declarando el pendiente. No afirmar que se completó tracking continuo.

## Casos de aceptación mínimos compartidos

| Caso | Datos preparados | Acción normal del usuario | Evidencia esperada |
|---|---|---|---|
| Nacional compatible | Servicio/categoría soportados y antecedente sintético opcional | Crear nueva carga, aplicar algunos campos, cambiar peso/fecha, guardar y evaluar | Solicitud nueva y tool inputs correlacionados; sin exigir cruce internacional |
| Internacional compatible | Servicio Perú–Chile y requisitos documentales coherentes | Crear/confirmar, evaluar, seleccionar y reservar | Coverage/capacity/quote, booking y condiciones fronterizas visibles |
| Sin compatibilidad | Fuera de cobertura o exceso de capacidad | Confirmar y evaluar | Rechazo o NO_MATCH explicable; sin tarjetas sintéticas |
| Sin historial | Contexto autorizado sin antecedentes | Abrir sugerencias | Ausencia de recomendación, se puede continuar manualmente |
| Retomar | Booking creado por el flujo real | Abrir con sesión válida sin caché de esa reserva | Estado persistido y acciones recuperables; sin usar caché como permiso |

Las tablas describen resultados a verificar, no evidencia ya obtenida. Los IDs se resuelven desde datos/API; no se pide al usuario introducir UUIDs.

## Handoff corto para todos

Una publicación por corte: tarea D1, PR/SHA/base, qué acción funciona desde UI, contrato tocado, pruebas ejecutadas, qué falta y quién lo consume. JSON/capturas sanitizados. No publicar credenciales, tokens, correos reales de cuentas demo ni .env. Mocks permitidos para desarrollo visual explícito, nunca como prueba del flujo real.
