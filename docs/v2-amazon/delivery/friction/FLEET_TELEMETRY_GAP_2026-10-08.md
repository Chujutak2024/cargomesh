# Friction log — datos de circulación y telemetría de flota

Fecha: 8 octubre 2026. Alcance: nueva vista local del coordinador.

**Hallazgo:** la referencia visual contiene combustible, condición, velocidad y horas de motor. El contrato V2 de activos incluye estado/odómetro/características físicas; los reads de operaciones incluyen `lastKnownPosition` sin fecha de observación. No hay un read autorizado que aporte las demás mediciones o pruebe circulación actual. La sesión actual del navegador devuelve 401 al consultar el carrier.

**Impacto:** no se puede presentar el estado IN_SERVICE o un camión preferido como un vehículo GPS circulando, ni completar gráficos reales con valores inventados. La UI completa puede revisarse localmente, pero la validación autenticada necesita sesión y registros autorizados.

**Resolución local:** fuente de ejemplo explícita e independiente sin persistencia; fuente de servicio de solo lectura con schemas y grants reales. Datos desconocidos se conservan como desconocidos y fallos no producen sustitución por ejemplos. Ilustraciones 3D se identifican como decorativas.

**Pendiente de integración:** elegir y contratar una fuente autorizada de posiciones/telemetría; acordar assetId/tenant, observedAt, procedencia, unidades, vigencia y criterio de obsolescencia; publicar un read y verificarlo con datos reales. Una posición por sí sola no confirma velocidad, salud ni capacidad disponible.

No se alteraron permisos, cuotas, cloud, migraciones, seeds ni contratos. Este incremento no agenda mantenimiento ni asigna vehículos/conductores en nombre del transportista.
