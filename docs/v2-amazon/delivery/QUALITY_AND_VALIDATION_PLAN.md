# Plan ligero de calidad y validación — CargoMesh V2

Este plan adapta verificación, validación y mejora continua al plazo de la hackathon. Aplica a nuevas issues V2 y a gates pendientes; no cambia por sí solo el DoD, estado o fecha de una issue ya acordada en Linear. El dueño y el Tech Lead registran cualquier ajuste de alcance allí antes de exigirlo. La fuente de verdad funcional sigue siendo el contrato V2 correspondiente.

## Dos preguntas distintas

- **Verificación:** ¿la entrega cumple su contrato? El dueño ejecuta pruebas automatizadas pertinentes, casos negativos y revisión del PR. QA comprueba reproducibilidad; no implementa la corrección ajena.
- **Validación:** ¿una persona puede resolver el problema previsto sin una interpretación engañosa? Se observa un flujo representativo en Web o Alexa y se registra qué entendió, dónde dudó y si el resultado fue útil. Un test verde no sustituye esta observación.

Cada issue con código enlaza al menos una fila `contrato/requisito → caso y resultado esperado → ejecución (comando/versión/dataset) → resultado real → evidencia → defecto/reprueba`. Si el caso no aplica, explicar por qué. No usar el número total de tests V1 como prueba de cobertura V2. Las pruebas heredadas WebMCP/FR-1042 se rotulan regresión V1; los escenarios V2 viven en `supabase/scenarios/v2-*`.

## Revisión técnica y aceptación de PR

La revisión del integrador aplica el contrato de la issue y comprueba, de forma proporcional al cambio:

1. **Alcance y rama:** parte de `codex/v2-amazon-contracts`, corresponde a una issue V2 activa, no toca `main` y declara qué conserva o reemplaza de V1 y qué regresión ejecutó. Ni `AGENTS.md` ni una guía V1 restauran tres carriers fijos, WebMCP como dependencia V2 o un merge a producción.
2. **Dominio:** reglas puras y determinísticas; idempotencia y concurrencia optimista en mutaciones; estados técnicos, comerciales y visibles separados. No fijar carriers, número de tools, scores ni conteos históricos de pruebas como verdad global.
3. **Elegibilidad y costos:** sede no equivale a cobertura. Evaluar `ServiceArea`, `ServiceLane`, carga, activos/cupos y capacidad durante toda la ventana; `unknown` no es `eligible`. Evitar doble conteo de unidades o escoltas y no mezclar ofertas de carriers distintos sin responsabilidad comercial. Distinguir costos incluidos, estimados y desconocidos; repetir un envío revalida tarifa, capacidad y permisos sin exponer otro tenant.
4. **Datos y pruebas:** migraciones sin filas sintéticas de demo; escenarios en `supabase/scenarios/v2-*`; casos positivos y negativos descubiertos desde el repositorio. Una afirmación live requiere ruta ejecutable, datos, pruebas y evidencia. La cadena es `contrato → caso/resultado esperado → ejecución → resultado → defecto/reprueba`; los bloqueados no cuentan como aprobados.
5. **Experiencia y despliegue:** si cambia una interacción visible, añadir la ficha humana selectiva de este plan. Interpretar previews Vercel según `productionBranch` y `rootDirectory`; mover la app no autoriza cambiar producción incidentalmente. La documentación y Linear deben reflejar solo lo realmente entregado.

La [plantilla Linear](./LINEAR_ISSUE_TEMPLATE.md) define la secuencia de aceptación y la escala baja/media/alta. Los hallazgos funcionales medios/altos vuelven al dueño para corrección y reprueba; el integrador puede resolver ajustes bajos no semánticos con diff y prueba visibles. La aprobación precede al merge autorizado; un merge histórico se audita y no se repite.

## Prueba humana: cuándo y cómo

No se exige prueba manual para cada migración, tipo o refactor interno. Se activa cuando cambia un paso visible, copy/estado, accesibilidad, decisión de carrier/ruta, consentimiento/booking, integración de un proveedor, Alexa o la demo final. En una entrega puramente técnica, basta verificar automatizadamente y hacer revisión experta del contrato; el gate prueba el flujo completo cuando exista interfaz consumible.

La issue o acta de gate debe contener una ficha breve:

1. **Objetivo y actor:** qué intenta lograr el shipper/operador, perfil y supuesto del escenario; una persona que no implementó el flujo lo ejecuta cuando sea posible.
2. **Preparación:** commit/PR, URL o entorno local, escenario V2, acceso de prueba sin secretos, navegador/dispositivo y límites `live/local/simulado/pendiente`. No usar datos personales o créditos reales en capturas.
3. **Pasos numerados:** acción del usuario y, si hace falta preparar el entorno, comando exacto copiable desde el directorio indicado. Por ejemplo, desde `cargomesh/`, `pnpm install` si faltan dependencias y `pnpm dev` para abrir la UI local; confirmar la URL que imprime el servidor, no presuponer puerto. Para MCP, usar el cliente/README y token de prueba autorizados, nunca pegar el token en Linear. No pedir `pnpm test:mcp:local` como validación humana del producto mientras su caso V1 conocido siga fallando.
4. **Oráculo:** resultado observable esperado por paso, incluidos carga/error/desconocido; especificar qué dato es sintético y qué fuente lo respalda. Para mapa: ruta y ETA estimadas no son cobertura, oferta ni entrega garantizada. Para Alexa: una prueba local MCP no equivale a invocación Alexa+ real.
5. **Registro:** resultado `pass/fail/bloqueado/no ejecutado`, fecha, rol del evaluador, captura/video o nota reproducible, duda observada, severidad, dueño del defecto, enlace y resultado de reprueba. Una ausencia de credenciales o acceso se registra `bloqueado`, no `pass`.

No dirigir al participante hacia el botón correcto durante la primera tentativa. Una prueba con integrante del equipo sirve como revisión formativa; no presentarla como validación con usuarios externos. Si no hay persona disponible, registrar el riesgo y ejecutar una caminata experta rotulada como tal.

### Guion mínimo copiable para una validación Web

El dueño prepara el escenario y entrega al evaluador una URL de preview autorizada o este arranque local. No se ejecutan migraciones, seeds ni acciones sobre producción como parte de una prueba humana improvisada.

```powershell
Set-Location C:\Users\HP\Documents\cargomesh\cargomesh
pnpm dev
```

El evaluador abre la URL que muestra el comando, entra con **cuenta de prueba autorizada** y completa sin indicaciones: `Dashboard → nueva solicitud → origen/destino → carga/equipo → fecha → revisión`. Registra en qué paso dudó, si pudo terminar, si entendió `desconocido` frente a `no elegible`, y si distinguió distancia/ETA estimadas de oferta y plazo confirmados. Si la pantalla sigue siendo solo prototipo, usa su enlace navegable y anota `prototipo`, no `Web operativa`. El dueño adjunta captura sin secretos y el evaluador da `pass/fail/bloqueado` por expectativa; un fallo genera corrección y **segunda ejecución del mismo paso**. Juan puede observar el mapa y Luis el intake, pero cada defecto vuelve al dueño de la issue correspondiente.

La prueba humana de Alexa requiere acceso autorizado al canal y una invocación observada; las pruebas locales `pnpm test:mcp` y el cliente MCP externo son verificación técnica del servidor, no sustitutos de una conversación Alexa+. Si el acceso no existe, registrar `bloqueado` y ensayar solo el fallback rotulado. No pedir al usuario comandos con credenciales Bedrock, tokens o claves de mapas en el chat/issue.

## Gate por sprint y evidencia mínima

| Gate | Verificación focal | Validación humana proporcional |
|---|---|---|
| Sprint 1 | Esquema/RLS/seguridad MCP, prototipo y procedencia del mapa; matriz de fallos conocidos. | Una caminata no guiada Dashboard→intake→revisión en el prototipo y una lectura de estados del mapa. Alexa/Bedrock solo con acceso real, o bloqueo/fallback declarado. |
| Sprint 2 | Elegibilidad/capacidad ROAD, account linking, MCP V2 y preview Web con el mismo escenario. | Una persona completa un caso elegible y otro `unknown/ineligible`; comprueba que Web y MCP no prometen oferta/cobertura. Alexa real solo si existe acceso e invocación verificables. |
| Sprint 3 | Solicitud→discovery→oferta atribuible→ranking explicable; casos negativos y cambios de datos. | Comparar planes conocidos, revisar por qué se excluye un carrier y detectar si estimación parece cotización. |
| Sprint 4 | E2E, autorización, auditoría, seguridad y benchmark reproducible. | Ensayar Web y canal Alexa o simulación rotulada, recuperación de error y consentimiento antes de booking. |
| Sprint 5 | Regresión, instalación, accesos y coherencia video/runtime. | Ensayo de jurado con tiempo: iniciar, completar el flujo y explicar qué es real, estimado o pendiente sin ayuda del desarrollador. |

El gate acepta cada issue por su DoD individual; no convierte un porcentaje de Linear o un preview verde en validación del producto. Defectos medios/altos regresan al dueño según la [plantilla](./LINEAR_ISSUE_TEMPLATE.md); el gate conserva fallo, corrección y reprueba. Una capacidad bloqueada puede quedar documentada y fuera de demo, pero no se presenta como completada.

## Capacidad y mejora continua

En planificación, cada dueño anota una estimación ligera (horas o puntos acordados), confianza `alta/media/baja`, dependencias, fecha y margen para pruebas/revisión. El Tech Lead contrasta la suma con disponibilidad real de cinco personas; si excede capacidad, mueve alcance **antes** de prometerlo. No se infiere esfuerzo de la fecha límite. Una issue que no cabe se divide solo si produce resultados independientes y propietarios claros.

Al cerrar cada sprint, una revisión de 15–30 minutos registra: objetivo logrado/no logrado, evidencias de producto, defectos abiertos por severidad, una observación de usuario y una decisión de alcance para el siguiente sprint. Una retrospectiva de 10–15 minutos elige **una mejora de proceso con dueño y fecha**; se comprueba en el gate siguiente. Registrar esfuerzo real frente a estimado para aprender, no para calificar personas.

Medir pocas señales consistentes: (1) escenarios críticos V2 que pasan / escenarios críticos ejecutados, con los bloqueados aparte; (2) defectos medios/altos abiertos y tiempo hasta reprueba; (3) tareas aceptadas / comprometidas por sprint; (4) finalización sin ayuda y dudas por paso en pruebas humanas. Para latencia/token, usar solo benchmark con baseline, dataset, versión y p50/p95; no mezclar esas métricas con aceptación de experiencia. Cada acta define fuente, corte y limitaciones de sus números.

Esto usa prácticas de Scrum, V&V e ingeniería de calidad de forma proporcionada; **no** implica certificación CMMI/MoProSoft/ISO ni cumplimiento integral de sus modelos.
