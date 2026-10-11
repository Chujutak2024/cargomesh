# HAC-45 — Integración del portal carrier V2

## Alcance y rama autorizados

- Dueño y aprobador: Cristhian Chujutalli. [HAC-45](https://linear.app/hackatonteamcargomesh/issue/HAC-45/bug-integrar-identidad-carrier-independiente-permisos-y-portal-v2).
- Base medida: `main @ 9d0c3ee32179f00242a6961b90116293a1bc6d0e`.
- Rama registrada y autorizada por Cristhian: `codex/v2-carrier-portal-integration`; PR directo a `main`.
- Este incremento corrige la integración de HAC-43/HAC-41; no traslada sus issues core ni certifica F-02.

## Contrato implementado

El portal identifica al carrier con Auth + CarrierOperator activo y verificado + carrier activo + grant server-owned vigente. No crea OrganizationMember ni utiliza un ID de operador como miembro shipper. La lista de transportistas procede del servidor, sin referencias UUID introducidas a mano ni un catálogo global.

| Rol | Perfil, catálogo y flota | Oferta/booking/hold | Ejecución e incidentes |
|---|---|---|---|
| ADMIN | Lee y publica/revisa registros propios | Opera según estado y evidencia | Opera según estado y evidencia |
| OPERATOR | Solo lectura | Opera según estado y evidencia | Opera según estado y evidencia |
| DISPATCHER | Solo lectura | Solo lectura | Opera según estado y evidencia |

La UI filtra acciones por rol/estado; la BD autoriza cada llamada nuevamente. Ventanas, vigencia, versiones, pertenencia y compromisos siguen comprobándose en los servicios/funciones existentes. Las publicaciones de límites y métricas siguen reservadas a ADMIN. No se cambia el contrato de los comandos shipper existentes.

Login admite retorno a /carrier-portal, /dashboard o /v2-workspace mediante whitelist; un usuario exclusivamente carrier va al portal. El portal permite cerrar sesión. Selección de oferta y autorización del booking corresponden al shipper y no aparecen como acciones del carrier. El 3D es ilustrativo; no representa GPS ni disponibilidad. El mapa conserva fuentes y estados registrados, y funciona como lista cuando falta proveedor cartográfico.

## API y persistencia

- GET /api/v2/carrier-portal/access: identidades carrier autorizadas, rol y nombre.
- GET /api/v2/carrier-portal/carriers/:carrierId: perfil propio; POST .../revisions: revisión por ADMIN.
- Familias de catálogo bajo el mismo prefijo: depots, services, partners, services/:serviceId/areas, services/:serviceId/lanes, assets, capacity-pools, calendars, maintenances, repositioning-blocks, asset-capabilities, capability-definitions, drivers, vehicle-combinations, driver-assignments y vehicle-assignments. Conservan DTO, GET colección/detalle, POST creación/revisión, claves de idempotencia y versión esperada.
- GET .../routing/nodes y .../routing/conditions: solo registros compartidos sin organización y del propio carrier. Nunca publica condiciones de otro carrier u organización.
- Las rutas de oportunidades, ofertas, holds, bookings, ejecuciones e incidentes siguen siendo /api/v2/carriers/:carrierId/... y reutilizan el workflow vigente.
- Respuestas del namespace carrier-portal: Cache-Control no-store, private y Vary Cookie/Authorization. Cookie POST exige mismo origen; bearer válido se verifica con Auth.

La migración aditiva 20261010225539 añade recibos carrier en private.v2_carrier_catalog_receipts (RLS, sin lectura directa, dos FK, índice) y RPC de acceso/catálogo/routing. Los comandos de catálogo comparten la validación vigente, con dispatch del recibo por principal carrier o miembro. El camino del miembro mantiene su autorización. No se modifican bytes de migraciones anteriores ni se insertan fixtures en la migración. El manifest incorpora su hash y dependencia.

El inventario FK cambia por las dos FK de los recibos; QA debe conciliarlo desde el catálogo del SHA revisado. No se modifica su matriz de F-02 ni se atribuye cobertura por inferencia.

## Evidencia local — 10 octubre 2026

Banco descartable creado para este incremento: hac45-carrier-local, API 59321, BD 59322. No se reinició el banco compartido cargomesh-v2-local ni el frontend del usuario en 3001. El preview 3090 usa únicamente este banco; su archivo .env.local no se versiona y no contiene service_role.

- Reconstrucción desde cero: 28 migraciones aplicadas.
- Perfil V2 completo por psql/pgTAP: 1015/1015, incluida suite 34 con 27 controles de acceso, idempotencia, versión, revocación y frontera authenticated. Cada suite revierte su transacción.
- Typecheck y arquitectura: PASS.
- test:release: 317/317; test:logistics, test:v2-conversation y test:v2-chat-workflow: PASS.
- Build Next de producción: PASS.
- Smoke HTTP/MCP con OAuth PKCE real local: 24 grupos PASS, sin service_role en llamadas de negocio.
- Smoke Next HTTP/cookies: 28 controles PASS para ADMIN/OPERATOR/DISPATCHER sin OrganizationMember, whitelist de retorno, CSRF, perfil, flota y rechazo de mutaciones no autorizadas.
- Recorrido separado: shipper crea solicitud, alternativas, plan y oportunidad; carrier publica oferta propia; shipper selecciona y autoriza booking/hold/ejecución; carrier confirma capacidad y booking, publica asignaciones de conductor/vehículo, inicia y completa ejecución; booking termina COMPLETED.
- Revisión visual local: login vuelve al portal, selector muestra solo carrier autorizado y rol OPERATOR, flota en lectura sin edición. Datos rotulados SYNTHETIC.

Los números describen esta ejecución, no reemplazan el DoD. Ningún resultado local acredita Alexa+ live, GPS, adaptador carrier externo, Bedrock ni certificación alojada.

## Reproducción y handoff a QA

1. Actualizar desde origin/main y revisar el SHA del PR; nunca combinar un harness antiguo con migraciones de otro corte.
2. Crear banco propio con project_id hac45-carrier-local y puertos 59321/59322 libres; copiar la cadena supabase-v2/supabase/migrations, desactivar seed automático y verificar propiedad antes de resetear. No usar --linked ni un db-url alojado.
3. Ejecutar explícitamente supabase/scenarios/v2-road-baseline/seed.sql con local_only=1; instalar pgTAP y ejecutar el perfil de supabase-v2/test-profiles.json.
4. Para HTTP/MCP: HAC41_BANK_DIR apunta a ese banco. HAC41_LOCAL_STATUS_FILE permite leer salida JSON de status guardada de forma privada, evitando el fallback npx.cmd de Node en Windows. Ejecutar desde cargomesh: node --conditions=react-server --import tsx scripts/hac41-channels-http-smoke.mjs. El archivo status incluye claves locales y no se adjunta a la evidencia.
5. Usar un banco limpio entre repeticiones del smoke, que deja datos sintéticos para revisión visual; no correr suites que compartan fixtures simultáneamente.
6. Para cookies/UI: construir e iniciar Next con URL/anon del banco propio en 3090. HAC45_BANK_DIR apunta al banco; ejecutar node scripts/hac45-portal-http-smoke.mjs. Genera tres actores sintéticos y sus credenciales en .env.hac45-actors.local, ignorado por Git; no imprimirlo ni adjuntarlo. Los datos manuales persisten únicamente en el banco descartable.

Ramón puede completar sus seeds reutilizando los DTO actuales; registrar administrador de catálogo, operador comercial, dispatcher, otro carrier y shipper separados. No elevar permanentemente un operador para hacer pasar una prueba ni incorporar datos de demo a migraciones.

## Despliegue preparado, aún pendiente

1. Revisar/mergear el PR autorizado y fijar SHA; confirmar el historial y hashes del Supabase V2 alojado antes de decidir qué migraciones faltan. No inferir aplicación alojada a partir del banco local.
2. Respaldar y revisar la migración aditiva HAC-45 antes de aplicarla al destino V2 autorizado, en su ventana. No resetear el alojado ni aplicar fixtures locales allí automáticamente.
3. Crear/configurar un preview específico del SHA con NEXT_PUBLIC_SUPABASE_URL y anon/publishable del proyecto cargomesh-v2. No apuntarlo al Supabase V1, ni copiar una service_role al cliente. Conservar productionBranch, rootDirectory, aliases y producción.
4. Reprobar login de actores propios del entorno, aislamiento, rechazo de roles y el recorrido completo con dataset aprobado. Verificar el namespace nuevo antes de presentar el frontend como integrado en remoto.
5. Entregar evidencia fechada a QA. El merge/CI no sustituyen esta certificación alojada.

## Fricción observada

La preparación inicial del smoke usó un code con guiones, que el DTO de catálogo rechaza correctamente. Además, ejecutar pgTAP y un smoke que persiste los mismos IDs en paralelo provocó una colisión de fixtures. Se corrigió el code, se reconstruyó solo el banco descartable y se midieron secuencialmente. No eran defectos funcionales del producto ni justifican relajar los contratos.

## Revisión visual final del catálogo

La sede sintética del escenario v2-road-baseline usaba QA-PIURA y no tenía address_line. El lector rechazaba la colección con CATALOG_DATA_INCOMPLETE, de acuerdo con el DTO vigente. Se corrige exclusivamente ese fixture a QA_PIURA y un label sintético explícito; las coordenadas siguen desconocidas y la sede no concede cobertura. El smoke de cookies incluye ahora GET de sedes para los tres roles.

## Proveedor cartográfico del portal

Google Maps continúa siendo el proveedor cuando NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY está configurada y autoriza el dominio. Sin esa clave, o si falla su carga/autorización, el portal utiliza Leaflet 1.9.4 y las teselas estándar de OpenStreetMap por HTTPS. No requiere una clave Google para esta vista.

Las teselas se solicitan directamente desde el navegador, con atribución visible, caché HTTP normal y sin descarga anticipada/offline. Su disponibilidad es best-effort; si fallan, permanece la lista con procedencia. Política: https://operations.osmfoundation.org/policies/tiles/. No se envían registros de operación al proveedor: los overlays se dibujan localmente con las coordenadas/áreas publicadas que entrega la API autorizada. La región cartográfica solicitada es observable por el proveedor.

Las referencias sin coordenadas permanecen solo en la lista; no se inventan posiciones, GPS, geometría de rutas o disponibilidad. Se conserva la distinción de capas y áreas de exclusión. Las etiquetas de registros se insertan como texto, nunca como HTML.

La revisión visual detectó que el reset global de transform bajo prefers-reduced-motion anulaba la ubicación de teselas. Se conserva la reducción de animaciones y transiciones, sin resetear transformaciones estructurales del mapa. Leaflet desactiva sus animaciones cuando el usuario solicita movimiento reducido.

Verificación del cambio: typecheck y arquitectura PASS; release 317/317, logistics 120/120 y build PASS. El proveedor tiene dependencias ya fijadas en el lockfile, sin agregar paquetes. La certificación alojada se registra por SHA y deployment en la evidencia HAC-45; este cambio no cierra F-02 ni certifica integraciones de carriers/Alexa/Bedrock.
