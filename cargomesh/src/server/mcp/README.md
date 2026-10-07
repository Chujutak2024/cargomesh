# CargoMesh V2 MCP

El runtime registra únicamente `get_cargomesh_capabilities`, `get_v2_intake_options`, `create_v2_freight_request`, `get_v2_freight_request` y `evaluate_v2_road`. Usa los mismos servicios que REST. Un perfil V1 se rechaza.

El transporte local requiere opt-in, loopback y entorno development/test. El transporte remoto exige opt-in, origen HTTPS exacto y autenticación. OAuth y scopes conservan sus comprobaciones; sin identidad válida no se accede a datos de tenant.

El catálogo declara estado PARTIAL: las herramientas comerciales MCP completas y el acceso Alexa+ live conservan sus pendientes. Crear una solicitud y evaluar elegibilidad no autoriza booking.

Las tools, host y runner WebMCP V1 fueron retirados del código activo; el corte anterior permanece en Git. Ver [contratos V2](../../../../docs/v2-amazon/contracts/ALEXA_MCP_AWS.md).
