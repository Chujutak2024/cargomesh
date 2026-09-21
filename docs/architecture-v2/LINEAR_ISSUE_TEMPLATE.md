# Plantilla Oficial Estandarizada para Issues de Linear
## CargoMesh V2 — Amazon Developer Hackathon 2026

Esta plantilla define la estructura obligatoria que deben tener todas las tareas creadas en **Linear** para asegurar que tanto los desarrolladores como el **Orquestador Autónomo de IA** comprendan el contexto exacto, las restricciones técnicas, las dependencias de equipo y los criterios de validación.

---

```markdown
<!-- ================================================================= -->
<!-- METADATOS BÁSICOS DE LINEAR                                       -->
<!-- ================================================================= -->
**Título:** [HAC-XX] <Rol / Área>: <Verbo en infinitivo + Resultado conciso>
**Asignado a:** <@Nombre_Desarrollador> (Ej: @Cristhian, @Axel, @JeanPaul, @Luis, @JuanAntonio)
**Proyecto:** CargoMesh V2 — Alexa Hackathon
**Hito (Milestone):** Sprint 1 — MCP Contracts & Alexa Baseline
**Estado:** Todo / Backlog
**Prioridad:** Urgente / Alta / Media
**Labels:** Backend, Frontend, CI/QA, Alexa-MCP, Governance
**Fecha Límite:** <Día, DD de Mes de 2026>

---

## 🎯 1. Contexto Detallado de la Tarea

### 1.1 Objetivo
- **Qué problema resuelve:** [Descripción clara de la necesidad técnica o de negocio]
- **Para quién:** [Shipper, Carrier, Jurado del Hackathon, o Equipo Interno]
- **Resultado esperado:** [Qué comportamiento nuevo o contrato queda habilitado al terminar]

### 1.2 Herramientas y Tecnologías Requeridas
- **CLI / Entornos:** [Ej: GitHub CLI (gh), Supabase CLI, Node 22, pnpm, Docker]
- **Frameworks & Librerías:** [Ej: Hono V2, Zod, pgTAP, Alexa Skills Kit (ASK), Next.js 15]
- **Servicios Locales:** [Ej: PostgreSQL local 127.0.0.1:54322, endpoint local http://localhost:3000/mcp]

### 1.3 Sugerencias y Flujo Requerido
- **Paso 1:** [Acción inicial, ej: crear rama desde codex/c-mcp-contracts y abrir Draft PR]
- **Paso 2:** [Patrón recomendado, ej: desacoplar en *-policy.ts puro sin server-only para tests rápidos]
- **Paso 3:** [Validación con esquemas Zod y sobre canónico { ok, data }]
- **Paso 4:** [Ejecución de pruebas unitarias locales antes de solicitar revisión]

### 1.4 Entrega Final (Definition of Done - DoD)
- [ ] Código fuente implementado en la rama asignada sin tocar archivos ajenos.
- [ ] Pruebas unitarias correspondientes creadas y pasando al 100%.
- [ ] TypeScript compila con 0 errores (`pnpm typecheck`).
- [ ] Pull Request en GitHub sacado de Draft (`gh pr ready`), con revisores `@Chujutak2024` y `@AxelArista`.
- [ ] Enlace al PR o evidencia anclada en este ticket de Linear.

### 1.5 Checklist de Avance
- [ ] Rama de feature creada y Draft PR registrado en GitHub.
- [ ] Implementación de lógica central / contratos.
- [ ] Pruebas locales verificadas en verde.
- [ ] Code review solicitado a revisores obligatorios.
- [ ] Resumen de lo elaborado completado al final de este ticket.

---

## 🚨 2. Principales Restricciones & Gobernanza
- **🛑 CERO MERGES O PUSHES A `main`:** La rama `main` está estrictamente protegida y congelada hasta el 22 de Septiembre a las 23:59 por la evaluación del jurado anterior.
- **🔒 MERGE RESTRINGIDO A PERSONAS AUTORIZADAS:** Ningún desarrollador puede mergear su PR individualmente a `codex/c-mcp-contracts`. La integración se realiza de forma sincrónica en el **Gate-1** a través del Integrador de Ciclo (Cristhian Chujutalli / Tech Lead) en la rama `feat/cycle-1-integration`.
- **🗄️ CERO DATOS DE PRUEBA EN MIGRACIONES:** Prohibido agregar `INSERT` de camiones, usuarios o datos sintéticos en `supabase/migrations/`. Todo dato demo va en `supabase/scenarios/<scenario>/seed.sql`.
- **📦 CONCURRENCIA OPTIMISTA:** Toda mutación de flete debe validar `expected_draft_version` e incrementar `draft_version + 1`.

---

## 🌿 3. Ramas de Trabajo
- **Rama Asignada:** `feat/<rol>-<ticket>-<descripcion-corta>` (Ej: `feat/be2-hac-6-draft-idempotency`)
- **Rama Base:** `codex/c-mcp-contracts` (Obligatoria para branches y PRs)
- **Pull Request en GitHub:** `PR #XX` (Estado: Draft ➔ Ready for review)

---

## 👥 4. Coordinación y Dependencias
- **🤝 Coordinación requerida con:** [@Nombre_Compañero (ej: @AxelArista para contratos de voz Alexa)]
- **Depende de / Bloqueado por:** [Ninguno / Esperando PR #XX o Guía X]
- **Desbloquea a:** [Ej: Desbloquea a @Luis para HAC-19 / HAC-8]

---

## 🤖 5. Resumen de lo Elaborado (Para el Orquestador Autónomo)
> *Esta sección la llena el desarrollador o el agente al terminar la tarea. El Orquestador la compara automáticamente contra el Objetivo y el DoD para validar el cierre técnico.*

- **Commits Realizados:** `<hash_1> (título), <hash_2> (título)`
- **Archivos Creados / Modificados:**
  - `src/...`
  - `tests/...`
- **Métricas de Pruebas Obtenidas:**
  - TypeScript: `0 errores`
  - pgTAP: `XX / XX subtests passing`
  - Node / Hono: `XX / XX tests passing`
  - Build: `Compilación exitosa`
- **Estado del DoD:** `100% CUMPLIDO`

---

## ⚠️ 6. Registro de Fallas e Incidentes (Friction Log)
> *Si durante la ejecución se experimentó algún error de configuración, incompatibilidad de librerías, caída de servicio local o workaround no trivial, DEBE registrarse en ambos destinos:*

- [ ] **Log en Google Drive:** Documentado en `02_Friction_Logs_Borradores/FL-XX.md` (Para el bono del 10% del jurado).
- [ ] **Log Interno Local:** Documentado en `docs/04-execution/friction-logs/FL-XX.md` (Para seguimiento continuo del equipo y del usuario).
- **Resumen breve del incidente (si aplica):** [Ej: server-only causaba fallo en tsx --test; resuelto separando en *-policy.ts].
```
