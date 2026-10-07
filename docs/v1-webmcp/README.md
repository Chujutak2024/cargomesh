# CargoMesh V1 / WebMCP — Índice histórico

Los contratos, planes y evidencias públicos de la versión WebMCP están agrupados aquí: [planificación](./00-master/CargoMesh_Planeacion_WebMCP_FINAL.md), [requisitos y backlog](./01-requirements/CargoMesh_Catalogo_Requisitos.md), [contratos de datos](./02-database/CargoMesh_Supabase_Data_Contract.md), [capturas](./03-ux-ui/screenshots/README.md) y [ejecución/evidencia](./04-execution/WebMCP_Judge_Audit_Guide.md). El material V1 no es autoridad para V2.

PR #80 también incorporó [documentación intermedia de Amazon](../architecture-v2/README.md) con supuestos V1. Sirve para inventariar código y decisiones de transición, pero **no** reemplaza los contratos de `docs/v2-amazon/`.

Los seeds y escenarios existentes en `supabase/seed.sql` y `supabase/scenarios/` se consideran fixtures V1 hasta que un escenario indique expresamente `v2-*`. Las implementaciones WebMCP actuales pueden seguir funcionando como regresión o adaptador legado.

## Reglas de conservación

- No reescribir esta historia para que parezca V2.
- No copiar carriers, scores o capacidades V1 al catálogo V2 sin una decisión y datos V2.
- No presentar fixtures V1 como integraciones Amazon, Alexa o carriers V2 live.
- Cuando una issue V2 reemplace trabajo anterior, enlazar la issue cancelada en vez de cambiarle el alcance.

La fuente activa está en [`../v2-amazon/README.md`](../v2-amazon/README.md).
