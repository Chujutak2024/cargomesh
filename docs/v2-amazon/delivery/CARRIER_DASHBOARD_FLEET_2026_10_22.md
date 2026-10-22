# Carrier: Dashboard unificado y directorio de Flota

Fecha: 22 octubre 2026.

- Dashboard reúne Control Tower, mapa, lista de operaciones, incidencias y planificación. La antigua URL mantiene acceso a la misma vista.
- Directorio de camiones visible sin seleccionar servicio. Filtros por capacidad útil y tipo de equipo; búsqueda/estado y limpieza combinables.
- Tipos, capacidad, fotos y referencias proceden del catálogo autorizado. Referencias 3D compatibles se distribuyen de forma determinística; no cambian equipo o disponibilidad.
- Formularios de registro, programación y conductores conservan el servicio; las acciones de una tarjeta usan el servicio de esa unidad.
- Los filtros JSX del mapa se separan para evitar errores de cierre durante la edición del Dashboard.

Integración autorizada por Cristhian junto con PR151 Maps, PR153 catálogo offline y PR154 Cliente. Catálogo sin activar, sin cambios alojados de datos, AWS ni Google Cloud. El usuario realiza revisión visual y pidió no ejecutar pruebas locales. El gate remoto y el despliegue automático se registran por separado; este documento no afirma aceptación visual ni pruebas locales nuevas.
