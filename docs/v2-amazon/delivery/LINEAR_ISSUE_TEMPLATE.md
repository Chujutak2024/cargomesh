# Plantilla de issue Linear V2 — una principal por integrante; apoyos por necesidad

Usar esta estructura para toda issue nueva. El título combina `[ROL]` o `[SPIKE/BUG/BLOCKER/CHORE]` + **verbo en infinitivo** + objeto/resultado comprobable; por ejemplo, `[BE-1] Validar contrato MCP de intake V2 sin executor WebMCP`. No asignar un ID HAC manualmente. Copiar solo los campos pertinentes; una tarea operativa no necesita rama ficticia.

## Bloque A — Metadatos básicos

- **Versión / proyecto:** `V2` · `P-HAC-1`.
- **Sprint / milestone:** ciclo semanal y gate esperado.
- **Tipo:** `core` / `enabler` / `emergente`.
- **Responsable / rol:** una persona; coordinadores y revisores aparte.
- **Rama del ciclo:** nombre exacto aprobado para esta issue con código; `No aplica` si es soporte sin código. No se crea antes de registrar este campo y el manifiesto semanal.
- **Prioridad / labels:** usar labels existentes comprobadas en Linear; no escribir `v2`, `core` o `enabler` como labels aplicadas hasta crearlas con aprobación. El tipo puede constar en la descripción.
- **Fecha objetivo:** acordada con el responsable; distinguir freeze interno de plazo oficial.
- **Estimación y capacidad:** esfuerzo aproximado en la unidad acordada por el equipo, confianza `alta/media/baja` y disponibilidad confirmada. Revisar si cambia el alcance; una fecha sola no es estimación.

## Bloque B — Contexto operativo

### Objetivo

Problema, usuario y comportamiento observable que habilita. Indicar si el resultado es contrato, código, evidencia o decisión; no confundir prototipo local con integración live.

### Alcance

**Incluye:** superficies, datos, contratos/API/MCP y adaptadores que sí se modificarán.

**Fuera de alcance:** capacidades diferidas y afirmaciones que no se podrán demostrar en este sprint. Para V2, los seeds, tres carriers y scores de V1 no cuentan como entrega nueva.

### Herramientas y flujo sugerido

Herramientas, servicios o puertos necesarios **solo si son reales para esta tarea**. Pasos recomendados y validaciones; no fijar una versión de SDK, número de tests o puerto local sin necesidad comprobada.

### Dependencias y coordinación

- **Bloqueada por / desbloquea:** IDs de issues cuando existan.
- **Coordinar con:** persona y contrato compartido.
- **Decisiones pendientes:** auth Alexa, credenciales, dataset, diseño, mini challenge, etc.
- **Propiedad:** el responsable implementa, prueba y corrige los defectos funcionales de su issue. Una dependencia solo obliga al otro dueño a entregar su contrato; la revisión del PR comienza al finalizar, no reparte el trabajo entre todos.

### Relación con V1 / PR previo

Antecedente HAC/PR y decisión explícita: `reutilizar`, `reemplazar`, `archivar` o `regresión`. Si se reutiliza PR #80, identificar archivo/capacidad concreta; el merge histórico no satisface automáticamente el DoD V2.

### Definición de terminado (DoD)

- [ ] Resultado funcional o decisión verificable frente al objetivo y casos límite.
- [ ] Autenticación, RLS, idempotencia y concurrencia cubiertas cuando corresponda.
- [ ] Sin datos sintéticos en migraciones; escenario `v2-*` separado si aplica.
- [ ] Pruebas pertinentes **descubiertas y ejecutadas**, con comando/resultado; no conteos heredados.
- [ ] Evidencia de integración, preview o gestión; estado `live`, `local`, `simulado` o `pendiente` dicho con precisión.
- [ ] Documentación y dependencias actualizadas; comparación final con esta issue.
- [ ] Trazabilidad `requisito/contrato → caso/resultado esperado → comando o pasos → resultado real → evidencia → defecto y reprueba`, proporcional al riesgo y con casos bloqueados visibles.
- [ ] Si cambia un flujo visible o una decisión humana, ficha de validación con actor, escenario V2, pasos reproducibles, resultado esperado y observación de una persona ajena a la implementación, o bloqueo justificado; véase el [plan de calidad](./QUALITY_AND_VALIDATION_PLAN.md). Una prueba técnica interna no se presenta como usuario externo.

### Checklist de avance

- [ ] Contrato y dependencias acordados.
- [ ] Implementación o gestión realizada.
- [ ] Pruebas/revisión interna y evidencia disponibles.
- [ ] Hallazgos medios/altos corregidos por el dueño y reprobados; los bloqueos constan como tales.
- [ ] Entrega del responsable en `In Review`.

### Flujo de aceptación y escala de hallazgos

**Culmina → validamos → aprobamos → mergeamos a `codex/v2-amazon-contracts`.** El dueño entrega PR/evidencia, comandos y límites; el revisor coteja DoD y pruebas; el Tech Lead decide aceptación; el integrador autorizado hace el merge. Si un PR ya entró antes de cerrar la trazabilidad, se audita el merge existente y se registra la aceptación o el follow-up, sin recrearlo.

| Escala | Criterio y respuesta |
|---|---|
| Baja | Errata, enlace, metadato o aclaración documental sin cambiar dominio, API, seguridad, migración ni comportamiento. El integrador puede corregirla dentro del gate, mostrando diff, verificación y aviso al dueño; no se atribuye la implementación funcional a otra persona. |
| Media | DoD incompleto, contrato o prueba faltante, regresión acotada, estado de capacidad incorrecto o comportamiento funcional por ajustar. Se devuelve al dueño con reproducción, alcance y criterio de nueva validación; conserva la misma issue/rama si sigue abierta. |
| Alta | Riesgo de seguridad/RLS, pérdida o mezcla de datos, reserva/cotización falsa, incompatibilidad de contrato transversal o bloqueo de release. Se detiene la aprobación/merge, se asigna al dueño, se registra bloqueo/friction log si es material y se repite el gate tras la corrección. |

La escala describe **impacto**, no esfuerzo. Una edición de una línea puede ser alta si altera autorización. No abrir issue/branch emergente salvo que el arreglo tenga alcance independiente y sea aprobado en el manifiesto. En `In Review`, un hallazgo medio/alto devuelve la issue a `In Progress`; una corrección baja no simula `Done`. Un merge previo no convierte automáticamente una entrega parcial en aceptada.

## Bloque C — Gobernanza y cierre

- **Rama / PR target para código:** usar **solo la rama predeclarada** por esta issue en el manifiesto del sprint, desde `codex/v2-amazon-contracts`; PR a esa base, nunca a `main`. Para enabler sin código: `No aplica`, con enlace o captura como evidencia. Una emergente con código requiere issue y rama aprobadas antes de abrirse.
- **Despliegue:** un preview no autoriza cambiar Vercel producción ni su directorio raíz. Cualquier cambio de infraestructura externa requiere plan y autorización separados.
- **Resumen de lo elaborado:** commits/archivos afectados o acciones externas, pruebas y resultados observados, limitaciones honestas.
- **Friction log:** registrar un incidente material en `docs/v2-amazon/delivery/friction-logs/` y en la carpeta Drive acordada cuando aplique; no crear logs por cada error trivial corregido.
- **Estado final del responsable:** `In Review` con PR/evidencia. **Solo el Tech Lead** mueve a `Done` tras verificar DoD y merge autorizado para código, o enlace/acceso para soporte.

El sprint asigna una principal por persona y solo apoyos con entregable distinto y capacidad disponible; no se crean enablers por simetría. Una emergente requiere bloqueo real, relación con su issue madre y DoD propio. Véase [SPRINT_ROADMAP.md](./SPRINT_ROADMAP.md).
