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
- `main` permanece fuera de alcance salvo instrucción humana explícita y válida.
- Solo el Tech Lead o integrador autorizado ejecuta merges a la base.
- Cada rama debe corresponder a una issue V2 activa.

## Flujo

1. Comprueba estado, base, issue, dependencias y cambios locales.
2. Revisa el PR contra `docs/v2-amazon/CODE_REVIEW_GUIDELINES.md`.
3. Trata PRs V1 mediante una decisión explícita: cerrar, cherry-pick selectivo o reformular.
4. Integra por dependencias funcionales en una rama de ciclo.
5. Descubre scripts y suites presentes; ejecuta typecheck, lint, pruebas, pgTAP, build y E2E que apliquen.
6. Registra comandos, resultados, riesgos y evidencia.

Nunca declares un gate aprobado basándote en un número fijo histórico de pruebas.
