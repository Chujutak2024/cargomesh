# Ruta semanal e inventario de Sprint 1 — CargoMesh V2

Plan para discusión y carga posterior en Linear; los códigos `S1-*` son referencias de este documento, **no** identificadores HAC creados. Las fechas de los ciclos son las que hoy muestra Linear. El 19 de octubre es un freeze interno propuesto; [el plazo oficial de Devpost es el 23 de octubre de 2026 a las 12:00 PDT](https://amazonappdev2026.devpost.com/rules).

## Modelo 1 + 1 + N

- **1 core por integrante:** resultado de mayor impacto de la semana, rama aislada, pruebas pertinentes y PR a `codex/v2-amazon-contracts` cuando implica código.
- **1 enabler por integrante:** desbloquea a otro o produce evidencia verificable; se intenta cerrar al inicio del trabajo restante del sprint. Puede terminar sin rama ni PR si es gestión externa.
- **N emergentes:** solo para fallas, spikes o bloqueos reales que excedan la issue madre; registrar dependencia y DoD propio. No son cuota anticipada.
- El responsable entrega en `In Review`; el Tech Lead valida el gate y mueve a `Done`. Un preview verde no equivale a merge, integración Alexa ni release.

## Trayectoria por sprint

| Ciclo en Linear | Resultado demostrable y gate | Límite explícito |
|---|---|---|
| Sprint 1 · 19–25 sep | Contrato V2 compartido, corte ROAD acotado, MCP local reutilizable sin WebMCP obligatorio, primeras superficies Web y gates de CI; soporte AWS/Drive verificable. | No prometer Alexa live, flota multimodal ni cotizaciones confirmadas. |
| Sprint 2 · 26 sep–2 oct | Persistencia/escenario `v2-*` para sedes, áreas, lanes y recursos; intake Web y MCP sobre el mismo servicio; prueba de identidad remota Alexa+. | HAC-11 a HAC-16 antiguas no se ejecutan tal cual. |
| Sprint 3 · 3–9 oct | Discovery ROAD por ruta, carga y ventana; activos/cupos y oferta atribuible; ranking versionado y mapa con procedencia. | Una sede no prueba cobertura; WebMCP V1 no es executor V2. |
| Sprint 4 · 10–16 oct | Corte E2E Web/voz o simulación declarada con MCP 2025-11-25+, confirmación humana, errores y benchmark; prueba de demo. | Bedrock y Open Source solo si hay integración/artefacto real. |
| Sprint 5 · 17–23 oct | Freeze interno propuesto el 19; accesibilidad, regresión, video en inglés <3 min, feedback, evidencias y envío antes del cierre oficial. | Después del freeze, solo correcciones de release autorizadas; Sprints 6/7 quedan fuera de la postulación. |

Cada gate descubre suites y conteos vigentes. El alcance de Sprints 2–5 es orientación, no compromiso de diez tareas por semana antes de medir capacidad.

## Sprint 1: nuevas tareas core propuestas

| Ref. | Responsable | Título canónico de issue nueva | Entrega verificable / antecedente |
|---|---|---|---|
| S1-C1 | Cristhian · BE-2 / Tech Lead | `[BE-2] Implementar elegibilidad ROAD V2 por área, lane, carga y ventana con motivos trazables` | Política pura para `eligible/ineligible/unknown`, sin cotización ni cobertura inferida de una sede; pruebas de lane inversa, sobrepeso y dato faltante. Sustituye el alcance de HAC-6 solo donde haya técnica reutilizable. |
| S1-C2 | Axel · BE-1 / Alexa & Cloud | `[BE-1] Desacoplar tools MCP de WebMCP V1 y validar contrato de intake V2` | PR #80 ya está en la base: adaptar su transporte SDK, idempotencia y pruebas; documentar autenticación remota pendiente. `find/get` no se anuncia como discovery V2 ni Alexa live. PR #81 trata por separado el `AGENTS.md` contaminado. Antecedente HAC-5. |
| S1-C3 | Jean Paul · BE-3 / CI & QA | `[BE-3] Asegurar gates CI V2 para dominio, Hono y MCP con pruebas descubiertas` | CI reproduce typecheck, pruebas relevantes (incluidas las Hono), build y evidencia de fallos; no fija 147/160/366 como DoD. Antecedente HAC-7. |
| S1-C4 | Luis · FE-1 / Shipper UI | `[FE-1] Construir stepper V2 de sedes y carga con sugerencias provisionales verificables` | Captura sede/ubicación, fecha, embalaje, peso/dimensiones y restricciones; muestra dato faltante/unknown; usa contrato compartido y no WebMCP. Antecedente HAC-8/HAC-19. |
| S1-C5 | Juan Antonio · FE-2 / Carrier Surface | `[FE-2] Visualizar planes ROAD y motivos de elegibilidad en el mapa V2` | Prototipo tipado con ruta, equipo/cupo, ETA y estados `estimated/unknown`; fixtures V2 identificados, sin afirmar cotización o carrier live. Antecedente HAC-9/HAC-20. |

El corte de esta semana evita intentar implementar a la vez flota multimodal, permisos de aduana automatizados, booking por voz y Bedrock. Esas capacidades siguen en los contratos objetivo y entran en un sprint solo con dependencia y prueba realista.

## Sprint 1: un enabler por integrante

| Ref. | Responsable | Issue / acción | Evidencia para `In Review` |
|---|---|---|---|
| S1-E1 | Cristhian | Nueva: `[OPS] Clasificar código mergeado de PR #80 y acordar preview V2 sin tocar producción` | Decisión escrita de qué conservar/reemplazar; root de Vercel (`frontend/`) y plan de preview separado; revisión de PR #81; ningún cambio de `main` o producción. |
| S1-E2 | Axel | **HAC-17 existente:** solicitud de créditos AWS. | Confirmación verificable de solicitud; contrastar el formulario del ticket con [las reglas oficiales](https://amazonappdev2026.devpost.com/rules). Acceso a Bedrock es opcional y no condición para el track Alexa+. |
| S1-E3 | Jean Paul | **HAC-18 existente:** Drive/evidencias. | Tech Lead comprueba estructura, enlace y permisos; el comentario existente es evidencia, no cierre automático. |
| S1-E4 | Luis | Nueva: `[FE-1] Mapear campos y componentes V1 reutilizables sin heredar restricciones de carga` | Matriz de reutilizar/reemplazar/retirar; identifica ROAD/FTL/PALLETS y defaults incompatibles con V2. |
| S1-E5 | Juan Antonio | Nueva: `[FE-2] Catalogar datos mínimos de corredor, sedes y equipos para el mapa V2` | Inventario de fuente, precisión y estado por capa; distingue trazado estimado de capacidad/cobertura confirmada. |

HAC-17/HAC-18 **ocupan** las plazas de soporte de Axel y Jean Paul: no crear duplicados para cumplir 1+1. Como Sprint 1 empezó el 19 y la replanificación ocurre el 21, cerrar los enablers nuevos lo antes posible, tentativamente antes del 23, requiere validación de capacidad del equipo.

## Dependencias y gate de la semana

1. BE-2 publica tipos y ejemplos de elegibilidad a BE-1/FE-1/FE-2; éstos pueden iniciar con contratos tipados, pero no inventar resultados live.
2. BE-1 presenta matriz del código de PR #80 ya mergeado: reutilizar transporte MCP y servicios seguros; reemplazar hard filters WebMCP/ROAD-FTL-PALLETS donde corresponda; archivar worker V1 como regresión. El merge pasado no equivale a completar esta nueva issue.
3. BE-3 incorpora a CI las pruebas nuevas y obtiene comandos reproducibles; la suite completa se ejecuta antes del gate, sin objetivos numéricos heredados.
4. En el gate del 25, el Tech Lead verifica cada DoD y evidencia, decide merges a la base V2 y mueve a `Done` solo lo comprobado. Lo restante vuelve a `Pendiente` o se replanifica; no se etiqueta como completado por un preview verde.

Antes de cargar este inventario en Linear, confirmar nombres, asignaciones, capacidad restante de la semana, labels y decisión de tracks/mini challenges. No cambiar las ocho issues canceladas para simular este plan.
