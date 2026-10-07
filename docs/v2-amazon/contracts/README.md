# Contratos vigentes de CargoMesh V2

Estos archivos definen el **comportamiento objetivo** de V2. Una capacidad contractual no es una capacidad live hasta tener código, datos, pruebas y evidencia. `AGENTS.md` mantiene las invariantes de trabajo.

1. [Alcance del producto](./PRODUCT_SCOPE.md) y [arquitectura](./ARCHITECTURE.md): problema, límites de capas y flujo compartido Web/Alexa+.
2. [Dominio](./DOMAIN_CONTRACTS.md), [cobertura de carriers](./CARRIER_COVERAGE_AND_SERVICEABILITY.md), [discovery y ranking](./CARRIER_DISCOVERY_AND_RANKING.md) y [planes/flota](./TRANSPORT_PLANS_AND_FLEET.md): reglas comerciales y restricciones verificables.
3. [Alexa, MCP y AWS](./ALEXA_MCP_AWS.md): canal e integraciones; no declara Alexa+ operativa por dibujar una tool.
4. [Límite V1/V2](./V1_BOUNDARY_AND_MIGRATION.md): qué se preserva como regresión y qué no se hereda como producto V2.

Los modelos y diagramas editables están en [models/](../models/README.md). Los planes de trabajo y evidencias están en [delivery/](../delivery/README.md); ninguno sustituye estos contratos.
