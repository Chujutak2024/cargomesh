# Límite agregado del ruteador para varios camiones

Detectado al validar el caso pedido12t, dos pallets enteros6t, corredor con payloadLimitKg10t. La función `private.workflow_route` de20261007170000 compara totalWeightKg contra payloadLimitKg antes de conocer las asignaciones por vehículo. Resultado actual: ROUTE_PAYLOAD_LIMIT_EXCEEDED; el plan queda sin ruta elegible aunque cada vehículo potencial respete10t.

No es falta de datos ni se resuelve subiendo artificialmente el límite vial. No se modifica la migración histórica ni el corredor alojado para ocultarlo. El caso42 lo registra explícitamente como bloqueo conocido. El positivo diferente8t, dos bultos4t y dos camiones5t demuestra el soporte existente cuando la ruta previa no bloquea el total.

Corrección futura: acordar evaluación de límite vial por recurso/asignación y tratamiento provisional de ruta antes de disponer de plan; mantener límites duros por unidad indivisible, tara/bruto, dimensiones, evidencia y fecha. Requiere migración aditiva, regresión de ruteo/planes y autorización de rollout; ninguna capacidad se debe marcar confirmada por omitir el filtro previo. La cotización automática de varios camiones es otra capacidad pendiente.

Evidencia: `supabase/tests/42_v2_multiple_trucks.test.sql`, nueve recetas `supabase/scenarios/v2-client-carrier-flow-cases/seed.sql` y reporte de casos ordenados. No hubo nuevas escrituras comerciales alojadas.


## Resolución local Plan1

La migración aditiva `20261021034000_plan1_resource_route_payload.sql` corrige el chequeo preliminar sin elevar límites. Caso42 ahora comprueba 12t repartibles y mantiene el rechazo de una pieza indivisible12t. La validación física definitiva permanece por recurso. La migración `20261021035000_plan1_multi_resource_quotes.sql` y el planificador acotado añaden propuesta automática y alcance tarifario explícito. Son cambios locales pendientes de publicación/rollout: el diagnóstico anterior describe el corte desplegado original, no la nueva implementación.
