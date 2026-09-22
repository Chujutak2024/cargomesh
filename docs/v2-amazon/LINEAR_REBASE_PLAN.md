# Rebase de Linear para CargoMesh V2

Este documento registra el estado real de Linear y el orden de carga propuesto. No ejecuta cambios en Linear. La [propuesta detallada de Sprint 1](./linear_sprint1_v2_rebase_proposal.md) define cada issue, su dueño, rama y DoD; el [roadmap de hitos](./cargomesh_v2_milestones_architecture_roadmap.md) audita los Hitos 0–5 que ya cargó el equipo.

## Estado verificado el 21 de septiembre de 2026

- Proyecto `P-HAC-1 — CargoMesh V2 — Alexa Hackathon` con cinco integrantes, meta interna 19 de octubre y Hitos 0–5 ya creados. **No** volver a crearlos ni sustituirlos sin aprobación.
- Sprint 1: 19–25 de septiembre en Lima; HAC-17 (créditos AWS) y HAC-18 (Drive) están `In Review`. HAC-5 a HAC-10, HAC-19 y HAC-20 están `Canceled` y permanecen como historial.
- No existen todavía issues nuevas V2 de Sprint 1. Los nombres `S1-C1`, etc., en la propuesta son referencias, no identificadores HAC. Linear asignará los IDs al crearlas.
- Sprint 2 contiene HAC-11 a HAC-16 `Pendiente` con premisas WebMCP/BALANCED anteriores. Por instrucción del equipo **no se replanifican ni modifican ahora**.
- PR #80 ya fue mergeado en `codex/v2-amazon-contracts`; el MCP local no demuestra Alexa remota ni discovery V2. PR #81/#82 son correcciones de gobernanza/documentación aún sujetas al gate. Vercel preview sigue apuntando a `frontend/` y ese fallo se registra aparte; producción y `main` no se alteran por esta replanificación.
- Los Hitos cargados contienen declaraciones a corregir: HITO 0 se marca completo en texto con progreso 0%; HITO 1 fija 160 pgTAP y omite la core de Axel; HITO 2 exige ASK/latencia no comprobadas; HITO 4 contiene precio/autoaprobación ficticios; HITO 5 propone merge a `main` y conteos fijos. Véase la auditoría detallada del roadmap.
- El [cierre oficial de Devpost](https://amazonappdev2026.devpost.com/rules) es el **23 de octubre de 2026, 12:00 PDT**. El 19 es freeze interno propuesto. El formulario que figura en HAC-17 difiere del enlazado en las reglas; Axel debe verificar y guardar comprobante antes del cierre. Bedrock no es requisito del track Alexa+.

## Decisión de estructura

Conservar el proyecto, los ciclos y los hitos existentes para no perder trazabilidad. Asociar las nuevas issues V2 de esta semana al **HITO 1 + Sprint 1**, sin revivir issues canceladas. Aplicar `1 core + 1 enabler + N emergentes` por persona: cinco core nuevas, tres enablers nuevas y HAC-17/HAC-18 como las otras dos habilitadoras. El gate es el enabler de Cristhian, no trabajo colectivo sin dueño. `N` solo existe ante bloqueo real y exige issue/DoD propios.

Cada issue tiene un único responsable: implementa, prueba y corrige sus problemas. Una dependencia implica contrato/entrega, no que otro miembro repare su PR. Los compañeros revisan al terminar; solo el Tech Lead/integrador autorizado fusiona en el gate y mueve a `Done` lo verificado.

## Gobernanza de ramas por ciclo

1. Aprobar primero el manifiesto de ramas del sprint dentro de las issues. Para Sprint 1 son **cinco ramas core y una rama de integración**, enumeradas en la propuesta; no crear ramas auxiliares por costumbre.
2. Cada rama core parte de `codex/v2-amazon-contracts` y se vincula a una issue/PR concreto. Un enabler de evidencia usa `No aplica`; el gate declara `feat/cycle-1-integration` y el integrador la crea solo cuando hay PRs revisables.
3. Una emergente con código obtiene issue aprobada y nombre de rama añadido al manifiesto **antes** de abrirla. Las ramas V1 y PR #81/#82 son historia/excepciones de gobernanza, no patrón de ramificación futura.
4. Resolver solapamientos en la rama de integración del ciclo, ejecutar suites descubiertas y registrar resultados. No push/PR/merge V2 a `main` ni arreglo lateral de Vercel producción.
5. Evitar automatizaciones como `Closes HAC-X` que puedan poner `Done` antes de la verificación del Tech Lead.

## Estados y evidencia

| Estado | Core técnica | Enabler sin código |
|---|---|---|
| `Backlog` / `Pendiente` | Objetivo, dueño, rama propuesta, dependencia y DoD definidos; sin afirmar trabajo iniciado. | Dueño y comprobante esperado definidos. |
| `In Progress` | Rama declarada creada, trabajo real iniciado; Draft PR si ayuda a revisión. | Gestión iniciada. |
| `In Review` | PR listo, pruebas pertinentes, documentación y resumen/evidencia en issue. Límite del responsable. | Enlace/acceso/comprobante verificable. Límite del responsable. |
| `Done` | Solo Tech Lead tras gate, merge autorizado y DoD específico comprobado. | Solo Tech Lead tras comprobar evidencia. |

`Canceled` conserva motivo y antecedente; `Duplicate` solo para duplicados reales. El porcentaje del hito no sustituye esos estados. La [plantilla V2](./LINEAR_ISSUE_TEMPLATE.md) exige fuente de datos, limitaciones honestas y documento por issue.

## Orden cuando el equipo apruebe la carga

1. Confirmar responsables, capacidad restante, labels y manifiesto de seis ramas. Revisar qué correcciones del HITO 1 ya cargado se aplicarán en Linear; no tocar Sprint 2.
2. Crear ocho issues nuevas de Sprint 1 con los bloques A/B/C de la propuesta; mantener HAC-17/HAC-18 sin duplicados y en su estado hasta verificación de evidencia.
3. Vincular HITO 1, ciclo, dependencias y antecedentes V1; usar labels `v2`/`core`/`enabler` solo si existen o el equipo autoriza crearlas.
4. Registrar el acta Gate-1, PRs, documentos, suites y friction logs. Cerrar solo lo aceptado; lo bloqueado permanece visible o se replanifica.
