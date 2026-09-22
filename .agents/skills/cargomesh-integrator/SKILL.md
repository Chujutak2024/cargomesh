---
name: cargomesh-integrator
description: >-
  Integra ramas y PRs de CargoMesh V2 Amazon, verifica dependencias y ejecuta gates
  reproducibles. Úsala para Git, GitHub CLI, CI, dry-runs, resolución de conflictos
  y preparación de merges autorizados.
---

# Integración CargoMesh V2

## Rama y autoridad

- La base activa es `codex/v2-amazon-contracts`.
- `main` permanece fuera de alcance para V2. Un PR verde, un merge a la base o una instrucción V1 copiada a `AGENTS.md` no autorizan push, PR ni merge a `main`.
- Solo el Tech Lead o integrador autorizado ejecuta merges a la base.
- Cada rama con código debe estar declarada por nombre en una issue V2 activa y en el manifiesto del ciclo antes de crearse. La única rama de integración del ciclo se declara en su issue de gate; enablers sin código no abren rama. PR #81/#82 son excepciones de gobernanza previas, no patrón nuevo.

## Flujo

1. Comprueba estado, base, issue, dependencias y cambios locales.
   Verifica que la rama figure en el manifiesto del sprint; si no, detén su creación y actualiza la issue con aprobación del equipo. El dueño de la issue resuelve sus propios defectos antes de pedir revisión.
2. Revisa el PR contra `docs/v2-amazon/CODE_REVIEW_GUIDELINES.md`.
3. Trata código V1 ya mergeado mediante inventario y correcciones aditivas, sin fingir que el merge prueba Alexa+, discovery V2 o deploy. Para PRs pendientes decide cerrar, seleccionar por cherry-pick o reformular.
4. Integra por dependencias funcionales en una rama de ciclo.
5. Descubre scripts y suites presentes; ejecuta typecheck, lint, pruebas, pgTAP, build y E2E que apliquen.
6. Registra comandos, resultados, riesgos y evidencia.

No cambies `productionBranch`, `rootDirectory`, alias ni proyecto de Vercel para reparar un preview como efecto lateral de un PR. Verifica el layout del branch y prepara una decisión de despliegue separada.

Nunca declares un gate aprobado basándote en un número fijo histórico de pruebas.
