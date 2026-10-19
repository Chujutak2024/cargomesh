# Perfiles predeterminados en la demo alojada

Autorización: Cristhian solicita usuarios asignados automáticamente en las pantallas actuales. No introducir una segunda landing ni cambiar /clients o /carriers.

## Comportamiento

- /clients y sus vistas asignan Alex Morgan / Northstar Logistics como perfil visual de prueba, explícitamente con datos de ejemplo y solo lectura. No representa una membresía Supabase ni habilita pedidos persistidos o voz autenticada de Cliente.
- /carriers inicia la cuenta sintética configurada mediante autenticación nativa Supabase. El servidor comprueba que todos sus Carriers autorizados estén identificados como [SYNTHETIC]. Conserva RLS y permisos del catálogo. Contraseña solo en servidor, nunca en formulario, JSON de respuesta o bundle.
- El inicio de sesión normal sigue disponible. El autocompletado local mantiene sus restricciones anteriores. El cierre de sesión en la demo usa scope local para no desconectar otras computadoras de la misma cuenta de prueba.

## Activación explícita

Solo el entorno que sirve el dominio autorizado debe tener CM_ENABLE_DEMO=1, CARGOMESH_ASSIGNED_DEMO_ENABLED=true y CARGOMESH_ASSIGNED_DEMO_ORIGIN con el origen HTTPS exacto, sin barra final. Requiere CARGOMESH_ASSIGNED_DEMO_SECRET (al menos 32 caracteres), CARGOMESH_DEMO_CARRIER_EMAIL y CARGOMESH_DEMO_CARRIER_PASSWORD. Secretos como Sensitive en Vercel; nunca NEXT_PUBLIC_. Cambios a Root Directory, alias o productionBranch no forman parte de esta activación.

La sesión se inicia por POST de mismo origen a /api/auth/demo-session. No acepta credenciales, destinos o IDs enviados por el navegador; solo client/carrier. Sin flag, host exacto o configuración suficiente no se habilita. Las APIs V2 reales siguen exigiendo su identidad y membresía; el perfil visual no concede esos permisos.

## Validación

Pruebas en assigned-demo-policy.test.ts incluidas en test:release y test:carrier-entry: configuración/origen, CSRF, credenciales solo del servidor, errores controlados y exclusión de cuentas/carriers reales. Ejecutar tipos, arquitectura y build, y comprobar después los perfiles en HTTP alojado. No confundir esa comprobación con una conversación completa o validación visual.

## Voz

Gateway de Axel comprobado por /healthz 200. CARGOMESH_VOICE_WS_URL y CARGOMESH_VOICE_BRIDGE_SECRET corresponden al servidor; NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW requiere rebuild. El perfil visual Cliente no sustituye requireAuthenticatedMember. Una conversación con pedidos reales queda pendiente de una cuenta Cliente V2 y su membresía.
