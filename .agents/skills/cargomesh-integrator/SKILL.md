---
name: cargomesh-integrator
description: >-
  Suite maestra para el rol de Integrador en CargoMesh V2.
  Cubre la gestión y sincronización de las 5 ramas de desarrollo hacia 'codex/c-mcp-contracts',
  auditoría y gobernanza de Pull Requests con GitHub CLI (gh), ejecución de la batería
  de verificación integral (TypeScript, 160 pgTAP, 366 Node, build) y preparación del Gate-1.
---

# CargoMesh Integrator Master Suite

Esta suite reúne todas las directivas operativas, comandos de terminal y procedimientos de control
de calidad para el **Rol de Integrador** de CargoMesh V2 (Amazon Developer Hackathon).

---

## 🚨 1. Invariantes Sagrados de Git & Ramas

1. **PROHIBIDO MERGEAR A `main`:**
   - La rama `main` está protegida y congelada (despliegue del hackathon anterior en evaluación hasta el 22 de Septiembre a las 23:59).
   - La rama base para TODO el desarrollo del Hackathon Alexa es **`codex/c-mcp-contracts`**.
2. **CERO Merges Individuales Anticipados:**
   - Ningún desarrollador mergea su PR de forma aislada a la rama base.
   - Todos los PRs permanecen en **`In Review`** hasta la sesión sincrónica del **Gate-1 (Viernes 25)**.
3. **Integración Conjunta en `feat/cycle-1-integration`:**
   - En el Gate-1 se integran las 5 ramas en una rama unificada, se ejecutan las pruebas de humo duales y la suite completa, y recién se realiza el merge a `codex/c-mcp-contracts`.

### Mapa de Ramas del Sprint 1:
- `feat/be2-hac-6-draft-idempotency` (Cristhian — BE-2 & Tech Lead)
- `feat/be1-hac-5-alexa-skill-base` (Axel — BE-1 / Alexa & Cloud)
- `feat/be3-hac-7-ci-baseline-runner` (Jean Paul — BE-3 / CI & QA)
- `feat/fe1-hac-19-design-tokens-components` + `feat/fe1-hac-8-intake-stepper-hono` (Luis — FE-1)
- `feat/fe2-hac-9-carrier-tools-audit` (Juan Antonio — FE-2)

---

## 🛡️ 2. Gobernanza y Operación de Pull Requests (`gh` CLI)

### Crear PR con Estándar V2:
```bash
gh pr create \
  --base codex/c-mcp-contracts \
  --head <rama-feature> \
  --title "[HAC-X] <Rol>: <Descripción>" \
  --body "Closes HAC-X." \
  --draft
```

### Gestión de Revisiones y Estados:
```bash
# Inspeccionar estado y rama base de un PR
gh pr view <PR_NUMBER> --json number,title,state,baseRefName,isDraft,mergeable

# Sacar de Draft y solicitar revisión obligatoria
gh pr ready <PR_NUMBER>
gh pr edit <PR_NUMBER> --add-reviewer Chujutak2024,AxelArista

# Validar checks de CI en el PR
gh pr checks <PR_NUMBER>
```

---

## 🏃 3. Batería de Verificación de Release (Matriz 100% Verde)

Antes de autorizar cualquier integración al Gate-1, deben cumplirse sin excepción los 4 pilares locales:

```bash
# 1. Validación de tipos estrictos
cd cargomesh
pnpm typecheck

# 2. Validación de Base de Datos local (PostgreSQL 127.0.0.1:54322)
cd ..
npx supabase test db

# 3. Suites de Backend y Hono V2 (366 tests)
cd cargomesh
pnpm test:release

# 4. Compilación de producción Next.js (37 rutas)
pnpm build
```

> ⚠️ **Nota de `release:preflight`:**  
> Este script valida infraestructura en la nube (Supabase Cloud y variables remotas). Al estar congelado el entorno remoto por la evaluación del jurado anterior, **no forma parte del DoD local del Sprint 1**.

---

## 🧪 4. Protocolo Oficial de la Sesión Gate-1

1. **Crear rama de integración:**
   ```bash
   git checkout codex/c-mcp-contracts
   git pull origin codex/c-mcp-contracts
   git checkout -b feat/cycle-1-integration
   ```
2. **Fusión secuencial en orden de dependencia:**
   `HAC-6` (Idempotencia) ➔ `HAC-7` (CI) ➔ `HAC-5` (Alexa) ➔ `HAC-19/8` (Frontend) ➔ `HAC-9` (Carrier Audit).
3. **Prueba de Humo Dual:**
   - **Web:** Crear flete en `http://localhost:3000/freight-request/new` (DRAFT ➔ PENDING).
   - **Alexa (`/mcp`):** Enviar POST JSON-RPC a `http://localhost:3000/mcp` (`create_freight_request`) y verificar respuesta SSML.
4. **Merge final a `codex/c-mcp-contracts`:**
   ```bash
   git checkout codex/c-mcp-contracts
   git merge --no-ff feat/cycle-1-integration -m "chore(gate-1): integrate sprint 1 cycle into codex/c-mcp-contracts"
   git push origin codex/c-mcp-contracts
   ```
