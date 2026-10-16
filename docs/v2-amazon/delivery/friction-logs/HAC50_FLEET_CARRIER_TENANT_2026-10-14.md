# HAC-50 — flota Carrier consultaba rutas de organización

14-oct-2026. Incidente material de integración detectado en la adaptación del frontend.

Síntoma: loadFleet/readFleetResource consultaban /api/v2/carriers/:id, obteniendo FORBIDDEN_TENANT para una cuenta Carrier sin membresía Shipper. La fachada /api/v2/carrier-portal/carriers/:id devolvió 200 con catálogo existente.

Corrección: usar resourcePath según la familia del recurso y la fachada de catálogo Carrier. No se relajaron guards, RLS ni roles; no se añadió backend redundante. El modo conectado no cae en fixtures ante error.

Verificación: lecturas alojadas, alta/revisión de unidad sintética fuera de servicio desde UI, recarga, idempotencia y conflictos; 37 pruebas, tipos y arquitectura. Evidencia HAC50_CONNECTED_FLEET.md y salida/carrier-backend-adaptation-20261014/persistence-results.json en el workspace primario.
