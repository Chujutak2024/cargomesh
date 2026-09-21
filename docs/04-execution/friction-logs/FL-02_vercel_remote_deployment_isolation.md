# Friction Log #02: Bloqueo de Despliegue Remoto en Vercel por Evaluación Concurrente de Jurado

- **Fecha:** 2026-09-19
- **Ticket Relacionado:** HAC-9 / HAC-7 / HAC-6
- **Descubierto por:** Juan Antonio Coronado (FE-2) y Cristhian Chujutalli (BE-2)
- **Componente:** Infraestructura de CI/CD / Vercel Deployments / Supabase Cloud

---

### 1. El Incidente / Fricción
Al abrir Pull Requests para el nuevo Hackathon de Alexa (ej: PR #75), Vercel marcaba estado `FAIL` en el bot de GitHub. Esto causó confusión en el equipo, deteniendo a integrantes de frontend que asumieron erróneamente que el código o las dependencias estaban rotas, cuando localmente `pnpm install`, `pnpm test` y `pnpm build` pasaban al 100% en verde.

---

### 2. Causa Raíz
1. La aplicación anterior (Google WebMCP Challenge) está en evaluación activa por el jurado internacional hasta el 22 de Septiembre a las 23:59.
2. La configuración del proyecto Vercel remoto (`anjuje/cargomesh`) tiene como `Root Directory: frontend/`, mientras que la nueva versión V2 reorganizó el monolito bajo `cargomesh/`.
3. Intentar cambiar la configuración en Vercel o forzar despliegues rompería la entrega en vivo que los jueces de Google están auditando.
4. Además, las credenciales remotas de Supabase Cloud están bloqueadas para evitar mutaciones de datos en vivo.

---

### 3. Solución / Workaround de Ingeniería
1. **Regla de Invariante Absoluto:** Se prohibió formalmente cualquier merge o push contra la rama `main` y se designó `codex/c-mcp-contracts` como rama base del hackathon.
2. **Desacoplamiento de CI Remoto:** Se aclaró a todo el equipo que los checks remotos de Vercel y `release:preflight` no forman parte del DoD del Sprint 1.
3. **Arnés 100% Local:** Todo el desarrollo, pruebas de 160 pgTAP tests y compilación se ejecutan contra el stack local (`127.0.0.1:54322` y `localhost:3000`).
4. **Ticket de Migración Post-22 Sep:** Se postergó formalmente la reconfiguración del root directory y secretos de hosting para el 23 de Septiembre una vez cerrado el veredicto del jurado anterior.

---

### 4. Lección Aprendida y Valor para el Ecosistema
En transiciones rápidas entre hackathons o fases de lanzamiento, **las dependencias de despliegue en la nube deben desacoplarse del ciclo de desarrollo de código de aplicación**. Un entorno de desarrollo local hermético (Docker + Supabase CLI + Hono) asegura la continuidad operativa sin poner en riesgo evaluaciones en vivo.
