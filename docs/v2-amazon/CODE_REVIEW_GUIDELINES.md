# Guía de revisión V2

Toda revisión debe comprobar:

1. La rama parte de `codex/v2-amazon-contracts` y no toca `main`.
2. El cambio corresponde a una issue V2 activa y respeta su alcance.
3. Las reglas de dominio son puras, determinísticas y probables.
4. Las mutaciones preservan idempotencia y concurrencia optimista cuando corresponda.
5. Las migraciones no contienen datos sintéticos; los escenarios viven en `supabase/scenarios/v2-*`.
6. No hay carriers, cantidades de tools, scores o conteos de pruebas codificados como verdad global.
7. Se distinguen los estados técnicos, comerciales y visibles al usuario.
8. Toda afirmación de integración live tiene ruta ejecutable, datos, pruebas y evidencia.
9. Las pruebas se descubren dinámicamente y cubren errores además del happy path.
10. La documentación y Linear reflejan el contrato realmente entregado.
11. La elegibilidad no se infiere de una sede: verifica `ServiceArea`, `ServiceLane`, restricciones de carga y capacidad en toda la ventana; los datos desconocidos no se tratan como cobertura o disponibilidad confirmada.
12. Los planes de una o varias unidades no duplican capacidad, no cuentan escoltas como portadores y no mezclan cotizaciones de carriers distintos sin responsabilidad comercial definida.
13. El costo distingue componentes incluidos, estimados y desconocidos; repetir un envío recalcula precio, disponibilidad y permisos y no expone historial de otra organización.

Un PR que reutiliza código V1 debe declarar qué conserva, qué reemplaza y qué regresión ejecutó.
