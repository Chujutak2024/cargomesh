---
name: cargomesh-orchestrator
description: >-
  Orquesta de extremo a extremo el trabajo de CargoMesh V2 Amazon. Clasifica el
  requerimiento, activa las skills especializadas, verifica rama e issue, compara
  el resultado con la definición de terminado y comunica riesgos y evidencia.
---

# Orquestador CargoMesh V2

## Inicio obligatorio

1. Lee `../../../docs/v2-amazon/README.md` y determina si el material es V1 o V2.
2. Comprueba rama, cambios locales e issue V2 asociada.
3. Activa solo las skills necesarias:
   - contratos y ranking: `cargomesh-governance-contracts`;
   - backend, datos y MCP: `cargomesh-backend-architect`;
   - Git, PRs y gates: `cargomesh-integrator`;
   - Linear y evidencia: `cargomesh-team-coordinator`.

## Ejecución

- Respeta la base `codex/v2-amazon-contracts` y preserva trabajo ajeno.
- No eleves fixtures, seeds o resultados de V1 a contrato V2.
- Verifica afirmaciones live con implementación, datos, pruebas y evidencia.
- Compara el entregable final con los criterios y checklist de la issue.
- Registra un Friction Log cuando exista un fallo material, workaround relevante o riesgo reproducible; evita ruido por incidentes triviales.

## Cierre

Reporta resultado, verificación, decisiones V1/V2, riesgos restantes y siguientes acciones. No actualices sistemas externos fuera del alcance autorizado.
