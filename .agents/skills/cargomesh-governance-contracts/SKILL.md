---
name: cargomesh-governance-contracts
description: >-
  Define y revisa los contratos de dominio de CargoMesh V2 Amazon: sedes, rutas,
  carga, servicios de carrier, oportunidades, ofertas, idempotencia y scoring versionado.
  Úsala al cambiar reglas comerciales, descubrimiento, ranking o límites V1/V2.
---

# Gobernanza y contratos CargoMesh V2

## Fuentes obligatorias

Lee antes de actuar:

- `../../../docs/v2-amazon/DOMAIN_CONTRACTS.md`
- `../../../docs/v2-amazon/CARRIER_COVERAGE_AND_SERVICEABILITY.md`
- `../../../docs/v2-amazon/CARRIER_DISCOVERY_AND_RANKING.md`
- `../../../docs/v2-amazon/TRANSPORT_PLANS_AND_FLEET.md`
- `../../../docs/v2-amazon/V1_BOUNDARY_AND_MIGRATION.md`

## Invariantes

- Modela `0..N` carriers; nunca conviertas una lista de demo en verdad global.
- Separa carrier, sede, área de servicio, lane dirigida, capacidad por fecha, oportunidad y oferta comercial.
- Recomienda planes de transporte, no carriers aislados: distingue modo, equipo, activo/cupo, recursos portadores y auxiliares, y costo/ETA por plan.
- El peso físico, volumen y permisos son restricciones antes del scoring; los pesos de la `ScoringPolicy` son otra cosa.
- Una sede no concede cobertura automática; una zona puede servirse mediante un socio registrado.
- Aplica restricciones duras antes del ruteo/optimización y conserva motivos de exclusión o incertidumbre.
- No descartes carriers con una heurística opaca ni inventes precios, cobertura o disponibilidad.
- No atribuyas capacidad a escoltas, sumes activos incompatibles ni reutilices ofertas o permisos históricos como actuales.
- El ranking usa una `ScoringPolicy` persistida, versionada, determinística y explicable.
- Toda mutación reintentable preserva idempotencia y, cuando corresponde, concurrencia optimista.
- Distingue estados técnicos, comerciales y visibles al usuario.
- Conserva FR-1042 y el scoring BALANCED antiguo solo como regresión V1.

## Cierre

Entrega reglas, invariantes, casos límite y pruebas. Declara explícitamente si el cambio reutiliza, reemplaza o archiva comportamiento V1.
