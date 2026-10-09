# Cierre de revisión UML → BD/API — d3a80eb

## Resultado

La revisión está terminada y todas las filas sin certificación completa están clasificadas. **Esto no certifica F-02 completo ni que todo el UML esté implementado.** Hay dos defectos funcionales confirmados en la lectura, corregidos y probados localmente. Este paquete acompaña su integración autorizada en `codex/v2-amazon-contracts`; la aplicación alojada de la migración nueva permanece pendiente.

El corte solicitado es `d3a80eb28b7443e8f17c87e41dc6d81502a96e38`. Su árbol es idéntico al árbol de `7b8737d0b1e59a3f1b00a26c41903f623c170699`, que produjo la evidencia previa. La medición original se conserva en el paquete local de evidencia `salida/uml-bd-api-d3a80eb-20261009/mediciones-originales/`, fuera de este paquete publicado. Recalcular los mappings no equivale a ejecutar de nuevo toda la QA. El corte original y las pruebas nuevas se distinguen en las secciones siguientes.

## 1. Mappings corregidos

- OrganizationMember, CarrierOperator, ResponseIntegration y McpAccountLink: tablas, columnas, DTOs de entrada/salida, rutas y comandos de identidad actuales.
- Los targets `public.tabla.columna` se resuelven como columnas; antes se confundían con rutas JSON.
- El emisor MANUAL se mapea a la identidad compuesta de CarrierOperator, no a OrganizationMember.
- `RepositioningBlock.estimatedTravel` se vincula a `estimatedTravelSeconds`.
- Un tuple Zod de scopes se reconoce como array JSON con cardinalidad restringida.
- El inventario incorpora las rutas de la tabla de HAC-41: 225 rutas, sin tomar su presencia como prueba funcional.
- Los métodos de identidad se vinculan a sus comandos y a la suite 33; una operación relacionada conserva su límite de certificación.

Pruebas del harness: **22/22**. No se fijaron estados por número de fila ni se relajaron los controles de autorización.

## 2. Clasificación completa

Consultar [CLASIFICACION_PARCIALES.csv](./CLASIFICACION_PARCIALES.csv) o [su JSON](./CLASIFICACION_PARCIALES.json): **237/237 filas**, sin duplicados ni omisiones. Cada fila conserva el estado de matriz e indica categoría, motivo, dueño, evidencia y criterio de reprueba.

| Categoría | Filas | Interpretación |
|---|---:|---|
| Evidencia pendiente | 229 | Falta una medición atribuible al campo, relación, endpoint o semántica de clase. No demuestra ausencia de funcionalidad. |
| Documentación desactualizada | 4 | Tres atributos de McpAccountLink y su clase agregada: el UML no distingue metadatos de un vínculo verificado de la lectura de historia legacy con NULL. |
| Defecto funcional real | 4 | Dos atributos y sus dos clases agregadas. **Son dos defectos, no cuatro.** |

Los 146 métodos tienen su inventario relacionado y sus límites en [CLASIFICACION_METODOS.csv](./CLASIFICACION_METODOS.csv). No se infiere la semántica completa de cada método por el simple paso de una suite.

### Estados de matriz en el corte original, con mappings corregidos

| Inventario | Estado |
|---|---|
| 57 clases | 1 COMPLETO, 55 PARCIAL, 1 DIVERGENTE |
| 397 atributos | 274 COMPLETO, 120 PARCIAL, 3 DIVERGENTE |
| 93 relaciones | 51 COMPLETO, 42 PARCIAL |
| 225 endpoints | 209 IMPLEMENTADO, 16 PARCIAL |

Los 28 atributos de identidad que figuraban como FALTANTE ya tienen representación física y mapping de lectura. Se mantienen pendientes las pruebas por campo que no existen en el formato del harness. Las tres divergencias de identidad corresponden a `provider`, `externalSubjectRef` y `verifiedAt` históricos: HAC-41 conserva esos NULL y rechaza su acceso MCP. La aclaración documental propuesta conserva visible esta diferencia; no inventa datos ni marca las filas COMPLETO.

La relación 70 y el emisor CarrierOperator tienen representación y referencias actuales. Sus pendientes indican la prueba semántica que falta asociar, no una solicitud de rediseño. Una representación JSON/snapshot no necesita una FK ficticia para ser válida.

## 3. Dos defectos confirmados y corregidos localmente

| ID | Defecto y dueño | Reproducción mínima | Corrección y reprueba |
|---|---|---|---|
| UML-R01, media | RouteWaypoint.sequence — HAC-40 / Cristhian. `cargomesh/src/shared/schemas/v2/workflow.ts:121` en d3a80eb. | Publicar corredor con dos waypoints y crear ruta. La BD guarda 1,2; POST/GET omiten la secuencia. | Exponer orden 1-based del snapshot y exigirlo en el DTO de salida; conservar entrada sin sequence. SQL y HTTP verifican 1,2 y controles de acceso. |
| UML-R02, media | Booking.selectionDecisionId — HAC-40 / Cristhian. `cargomesh/src/shared/schemas/v2/workflow.ts:193` en d3a80eb. | Crear decisión y booking. La FK `decision_id` existe; POST/GET no devuelven `data.decisionId`. | Proyectar la FK persistida y tipar su UUID obligatorio. SQL y HTTP verifican el mismo UUID; tenant ajeno/anónimo y helper privado siguen denegados. |

[DEFECTOS.json](./DEFECTOS.json) contiene las referencias exactas obtenidas desde el commit, evidencia y criterios. La reproducción previa dejó cinco asserts rojos de estos dos defectos y controles válidos. Después de la corrección la suite 22 pasa **43/43**, con `SET CONSTRAINTS ALL IMMEDIATE` bajo authenticated, sin RESET ROLE previo.

Se agregó únicamente `20261009190000_hac40_uml_read_projection.sql` y la entrada correspondiente en el manifiesto. **Las 26 migraciones anteriores conservan sus hashes.** El delta propone una cadena de 27; la prueba usó un banco reconstruido con las 26 del corte y luego aplicó esa proyección local. No se presenta como un despliegue de 27 ni como una nueva medición integral de drift.

### Pruebas nuevas del delta

| Control | Resultado |
|---|---|
| Reconstrucción del corte | 26 migraciones; historial hasta 20261009000410 |
| Suite 22 antes/después | 38/43 → 43/43 |
| Perfil pgTAP V2 descubierto desde test-profiles.json | 985/985; las suites hacen rollback |
| Workflow/planner/confirmación/MCP en TypeScript | 20/20 |
| HTTP local | 6/6 controles: lectura propia 200, tenant ajeno 404, anónimo 401 para ruta y booking; ambos campos comprobados |
| Invariantes del modelo y DER generado | PASS; 57 clases, 397 atributos, 93 relaciones, sin certificación implícita de implementación |
| Manifiesto y hashes | 26 originales idénticos; 27 entradas del delta consistentes |
| Limpieza | Auth, organizaciones, carriers y sedes en 0; proyecto exclusivo detenido |

El HTTP usa usuarios sintéticos locales y claims firmados del fixture comprobados por Auth. No constituye una nueva certificación OAuth PKCE. Se conserva el control anterior de PKCE como evidencia histórica independiente.

El primer lanzamiento manual de la suite 20 requería inicializar pgTAP en extensions, tarea que realiza el runner nativo. Después de inicializar la extensión en el banco propio, la suite completa pasa; no se cambió el test ni se omitieron asserts.

## 4. Integración y entrega vigente — 9 octubre 2026

La integración fue autorizada expresamente por Cristhian: actualizar primero desde el remoto y publicar código y documentación en la base V2 compartida. Se hizo `git pull --ff-only origin codex/v2-amazon-contracts` desde un checkout existente de esa rama. No se reutiliza la rama cerrada de #114 ni se abre una rama auxiliar.

### Verificación de la integración

| Gate local | Resultado |
|---|---|
| TypeScript global | PASS, sin cambios de dependencias ni de tsconfig |
| Arquitectura | PASS, 174 módulos y 23 entradas cliente |
| Suite de release completa del package.json | 301/301 PASS |
| Build Next.js de producción local | PASS |
| Harness de matrices | 22/22 PASS |
| Manifiesto, UML y DER | PASS |
| Reconstrucción local | 27/27 migraciones, historial exacto; 26 hashes históricos conservados |
| Perfil pgTAP V2 completo | 985/985 PASS |
| Limpieza del banco nuevo | usuarios, organizaciones, carriers y sedes en 0; banco detenido |

Los 170 errores iniciales de tipos se debían a restricciones de lectura del sandbox sobre las dependencias enlazadas. Al ejecutar el mismo comando con acceso al checkout y sus dependencias, el typecheck pasó. pnpm rechazó reinstalar un node_modules enlazado fuera del proyecto; se ejecutó directamente el comando de release definido en package.json y el binario Next.js de las mismas dependencias. No se alteraron lockfile ni versiones.

Los logs de esta verificación se conservan en `salida/uml-bd-api-d3a80eb-20261009/` del operador. Este paquete publica el informe y los inventarios de revisión; no incluye respaldos, secretos ni datos de Auth. Linear no está conectado en esta sesión y no se atribuye publicación allí.

El workflow V2 actual se activa en pull_request, no en push a esta base. Los resultados anteriores son locales; no se atribuye un Actions nuevo ni se modifica el workflow para producirlo.

### Para Axel y QA

1. Actualizar la rama propia desde `origin/codex/v2-amazon-contracts`. Leer este documento y la aclaración de identidad antes de interpretar las matrices antiguas. El SHA de publicación se obtiene del commit que incorpora este paquete; `d3a80eb` identifica el corte auditado, no el nuevo HEAD.
2. QA: reprueba independiente R01/R02 por BD y HTTP con controles propios, tenant ajeno y anónimo; boundary bajo authenticated sin reset role. Verificar secuencias 1,2 y decisionId igual a la FK persistida. Regenerar las matrices del SHA integrado con los mappings de identidad actuales. Los CSV adjuntos clasifican el corte original; no son una nueva certificación de ese SHA.
3. Axel continúa el canal MCP sobre los servicios compartidos. No convertir las 229 filas de evidencia pendiente en requisitos de reimplementación: confirmar primero cada fallo. Mantener explícitos los límites de los 146 métodos relacionados.
4. La migración 27 debe aplicarse por el procedimiento alojado autorizado antes de desplegar el DTO que exige sequence y decisionId. Esta integración no ejecuta migraciones alojadas ni despliegues.

**F-02 conserva certificación parcial.** Queda cerrada esta revisión y separado el trabajo restante; no se certifica el UML completo, Alexa+ live, adaptadores externos ni el smoke alojado hasta IN_PROGRESS.
