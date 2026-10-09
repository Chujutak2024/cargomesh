# HAC-41 — Límite de consentimiento y canal alojado

- Fecha de trabajo: 8-oct-2026, Lima.
- Rama: `codex/v2-full-identity-mcp`; base `1e9ff995ef9c8fa6789e473263e64873bcb13fba`.
- Dueños: Axel/HAC-41 para identidad/MCP; frontend para UI de autorización; Tech Lead para habilitación/despliegue; HAC-44 para prueba independiente.
- Estado: backend con prueba OAuth real local; canal alojado y Alexa+ sin acreditar por este incremento.

## Evidencia y alternativa

El perfil local tenía OAuth server desactivado. Se habilitó únicamente su configuración local y se probó un cliente preinscrito con consentimiento Supabase, código de autorización y PKCE S256. El smoke provisiona/elimina ese cliente descartable con Auth Admin; los comandos de dominio usan anon key y tokens de usuario. No se confeccionan JWT para simular identidad real.

La metadata previa describía solo el endpoint CargoMesh de servicio `client_credentials`. Se añade descubrimiento del issuer Supabase cuando el bearer de usuario está habilitado; la emisión de tokens de servicio conserva su alcance. Esto permite probar el flujo de Auth separado del acceso Alexa+.

La ruta local `/oauth/consent` configurada requiere una pantalla real que recoja aprobación/denegación y describa permisos. El test backend ejerce ese consentimiento por SDK; no se presenta como prueba de la pantalla ni del proveedor Alexa. El catálogo mantiene PARTIAL por acceso Alexa+ y geocoder externo, y los adapters carrier API/MCP quedan pendientes de verificación.

## Criterio de conexión alojada

Autorizar el paquete actualizado, aplicar/verificar su esquema, registrar el cliente OAuth exacto y el registro privado de proveedor/TTL, publicar consentimiento, configurar issuer/resource HTTPS y reprobar usuario propio/ajeno/revocado y flujo comercial desde el cliente directo. Registrar esas pruebas con SHA, entorno y fuentes. La evidencia del banco local no sustituye esa verificación.
