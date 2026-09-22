# CargoMesh V1 / WebMCP — Índice histórico

Los contratos, planes y evidencias públicos de la versión WebMCP permanecen en las carpetas históricas del repositorio, en particular [planificación](../00-master/CargoMesh_Planeacion_WebMCP_FINAL.md), [requisitos](../01-requirements/CargoMesh_Catalogo_Requisitos.md) y [contratos de datos](../02-database/CargoMesh_Supabase_Data_Contract.md). Esta rama V2 no incorpora los borradores intermedios de Amazon ni la revisión interna de Axel. El material V1 no es autoridad para V2.

Los seeds y escenarios existentes en `supabase/seed.sql` y `supabase/scenarios/` se consideran fixtures V1 hasta que un escenario indique expresamente `v2-*`. Las implementaciones WebMCP actuales pueden seguir funcionando como regresión o adaptador legado.

## Reglas de conservación

- No reescribir esta historia para que parezca V2.
- No copiar carriers, scores o capacidades V1 al catálogo V2 sin una decisión y datos V2.
- No presentar fixtures V1 como integraciones Amazon, Alexa o carriers V2 live.
- Cuando una issue V2 reemplace trabajo anterior, enlazar la issue cancelada en vez de cambiarle el alcance.

La fuente activa está en [`../v2-amazon/README.md`](../v2-amazon/README.md).
