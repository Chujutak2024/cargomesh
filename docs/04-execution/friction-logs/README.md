# Registro Local de Friction Logs — CargoMesh V2
## Amazon Developer Hackathon 2026

Este directorio contiene la copia local y versionada de todos los **Friction Logs** del equipo.
Cada log documenta un incidente real, su causa raíz técnica y el patrón de ingeniería aplicado para resolverlo.

> 🌟 **Importancia para el Hackathon:**  
> Estos registros sirven como respaldo transparente de los desafíos técnicos superados y se sincronizan con la carpeta `02_Friction_Logs_Borradores/` de Google Drive para postular al **Bono del +10% del Jurado**.

---

## 📑 Índice de Friction Logs

| ID | Fecha | Tarea | Componente | Resumen del Incidente y Workaround |
|---|---|---|---|---|
| **FL-01** | 2026-09-19 | HAC-6 | Hono V2 / Node Test Runner | Incompatibilidad de `server-only` con `tsx --test`. Desacoplado en `*-policy.ts` puro y `*-server.ts`. |
| **FL-02** | 2026-09-19 | HAC-9 / HAC-7 | Vercel Deployment & CI | Vercel remoto apunta a `frontend/` (congelado por jurado anterior). Desacoplado de CI local y movido a ticket post-22 Sep. |

---

## 📝 Plantilla Rápida para Nuevos Incidentes (`FL-XX.md`)

```markdown
# Friction Log #XX: [Título del Incidente]

- **Fecha:** AAAA-MM-DD
- **Ticket Relacionado:** HAC-XX
- **Descubierto por:** [Nombre del Desarrollador]
- **Componente:** [Base de datos / Hono / Alexa / Vercel / Git]

### 1. El Incidente / Fricción
[Descripción precisa del error, log de consola o comportamiento anómalo]

### 2. Causa Raíz
[Explicación técnica del porqué falló]

### 3. Solución / Workaround de Ingeniería
[Cómo se resolvió la arquitectura o configuración]

### 4. Lección Aprendida y Valor para el Ecosistema
[Recomendación técnica para desarrolladores de AWS / Alexa / Supabase]
```
