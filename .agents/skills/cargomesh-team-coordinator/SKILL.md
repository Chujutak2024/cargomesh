---
name: cargomesh-team-coordinator
description: >-
  Suite maestra para el rol de Coordinador de Proyecto y Tech Lead en CargoMesh V2.
  Gestiona el flujo de sprints en Linear (Backlog -> In Review), audita Pull Requests
  bajo los 7 mandamientos de CODE_REVIEW_GUIDELINES y estructura las evidencias
  en Google Drive (HAC-18) para el premio AWS Builder ($5K) y Friction Logs (+10% jurado).
---

# CargoMesh Team Coordinator Master Suite

Esta suite reúne todas las herramientas de liderazgo técnico, gestión ágil en Linear,
auditoría estricta de código y catalogación de evidencias para el Hackathon de Amazon.

---

## 🚦 1. Gestión Ágil en Linear (Sprint 1)

### Máquina de Estados Oficial:
- ⚪ **Backlog:** Tarea definida y asignada.
- 🟡 **In Progress:** Rama creada y Draft PR abierto en GitHub.
- 🟢 **In Review:** Código completo y tests verdes locales. Se desmarca Draft en GitHub ("Ready for review").
- 🟣 **Done:**
  - **Tareas de soporte (HAC-17, HAC-18):** Se cierran manualmente al anclar el link/evidencia en Linear.
  - **Tareas técnicas (HAC-5 a HAC-9):** **PROHIBIDO cerrarlas antes del Gate-1**. Pasan a `Done` automáticamente al fusionarse en el Gate-1.

### Desbloqueo Rápido de Dependencias:
- Si un desarrollador se bloquea por variables remotas de Vercel/Supabase Cloud, recordar que producción está congelada hasta el 22 de Septiembre a las 23:59. El problema se aísla a un ticket post-22 Sep y el desarrollador continúa en local.

---

## 📜 2. Los 7 Mandamientos de Code Review

Todo PR debe auditarse contra la guía oficial `docs/architecture-v2/CODE_REVIEW_GUIDELINES.md`:

```text
[ ] 1. Rama Base: ¿El PR apunta a 'codex/c-mcp-contracts'? (Cero tolerancia con 'main').
[ ] 2. TypeScript Limpio: ¿Compila con 0 errores en 'pnpm typecheck'?
[ ] 3. Suite de Pruebas Verde: ¿Pasan las 160 aserciones pgTAP y los 366 tests de Node/Hono?
[ ] 4. Pureza de Dominio: ¿Los archivos '*-policy.ts' están libres de 'server-only' y llamadas a BD?
[ ] 5. Concurrencia e Idempotencia: ¿Se incrementa 'draft_version' y se valida versión esperada?
[ ] 6. Migraciones Limpias: ¿'supabase/migrations/' contiene únicamente DDL sin datos de prueba?
[ ] 7. Aislamiento de Rama: ¿El desarrollador modificó únicamente los archivos de su ticket?
```

### Plantilla de Aprobación en GitHub:
```markdown
### ✅ Revisión Técnica Aprobada — CargoMesh Tech Lead
- [x] Rama base correcta (`codex/c-mcp-contracts`).
- [x] TypeScript y build 100% verdes.
- [x] 160 pgTAP tests y suites Hono pasando.
- [x] Cumple con los 7 mandamientos de CODE_REVIEW_GUIDELINES.
**Estado:** Listo para la sesión sincrónica del Gate-1.
```

---

### Plantilla Oficial para Crear / Actualizar Issues en Linear:
- Consultar y aplicar la plantilla estandarizada en [`docs/architecture-v2/LINEAR_ISSUE_TEMPLATE.md`](file:///c:/Users/HP/Documents/cargomesh/docs/architecture-v2/LINEAR_ISSUE_TEMPLATE.md) (incluye Objetivo, Herramientas, Flujo, DoD, Checklist, Restricciones, Coordinación y Resumen para el Orquestador).

---

## 📁 3. Expediente de Evidencias en Google Drive (HAC-18) & Logging Dual

Estructura de las 4 carpetas creadas en Drive para el equipo:

```text
📁 CargoMesh - Amazon Hackathon 2026/
├── 📁 01_Kiro_Crew_Evidencias/    --> Transcripciones y capturas para el premio AWS Builder ($5K)
│   ├── 📁 Axel_Arista_BE1/
│   ├── 📁 Cristhian_Chujutalli_BE2/
│   ├── 📁 Jean_Paul_BE3/
│   ├── 📁 Luis_FE1/
│   └── 📁 Juan_Antonio_FE2/
├── 📁 02_Friction_Logs_Borradores/ --> Incidentes y workarounds para el +10% bonus del jurado
├── 📁 03_Audio_y_Locucion_Alexa/   --> Pruebas de voz y diálogos grabados
└── 📁 04_Video_Raw_y_Clips/       --> Grabaciones de pantalla en 1080p para el video final
```

### ⚠️ Protocolo Obligatorio de Registro Dual de Friction Logs:
Todo incidente o workaround descubierto debe documentarse obligatoriamente en dos lugares:
1. **En la nube (Drive):** `02_Friction_Logs_Borradores/FL-XX.md` (para el bono del 10% del jurado).
2. **En local (Repositorio):** [`docs/04-execution/friction-logs/FL-XX.md`](file:///c:/Users/HP/Documents/cargomesh/docs/04-execution/friction-logs/) (para el seguimiento y visibilidad del equipo).
