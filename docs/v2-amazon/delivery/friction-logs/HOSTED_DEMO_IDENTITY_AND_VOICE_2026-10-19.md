# Hosted demo identity and voice — 19-oct-2026

## Incompatibilidad confirmada

El autocompletado nativo Carrier y el perfil visual Cliente anterior estaban limitados a localhost. Un despliegue correcto no trasladaba esas identidades al navegador de los jurados. Además, Production apuntaba a un proyecto Supabase legacy; la corrección de URL/anon key eliminó los errores de consulta, pero no creó membresías Cliente V2.

## Resolución del alcance solicitado

Asignación automática de perfil visual Cliente en el origen demo explícito; sesión Carrier nativa con cuenta sintética del servidor. No hay un formulario nuevo ni cambian las rutas. El marcador de preview también activa transporte de ejemplo en hosting, con bloqueos de escritura; las APIs reales conservan RLS y autorización. Cuenta Carrier compartida: logout scope local evita desconectar otras sesiones.

## Límite de voz

Gateway AWS /healthz 200 y variables Production configuradas no equivalen a conversación desde Cliente. El perfil visual no satisface requireAuthenticatedMember y sus mutaciones se rechazan. Para micrófono con pedidos persistidos hace falta cuenta/membresía Cliente V2; no sustituir esa comprobación con una identidad ficticia en el servidor de voz. No se realizaron migraciones, creación de cuentas ni escrituras comerciales.

Evidencia: salida/assigned-demo-20261019/ del equipo del integrador y contrato ASSIGNED_DEMO_ACCESS_2026-10-19.md. Guardar solo metadatos; secretos fuera de Git.
