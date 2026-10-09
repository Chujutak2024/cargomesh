# Identidad, permisos y canales MCP — HAC-41

Este contrato concreta identidad y consentimiento para los servicios V2. La evidencia de implementación y sus límites están en [HAC41_IDENTITY_MCP](../delivery/HAC41_IDENTITY_MCP.md). Alexa+ live y la configuración alojada requieren evidencia independiente.

## Identidades y autorización

| Identidad | Prueba y permisos | Cambio de estado |
|---|---|---|
| OrganizationMember | Usuario Supabase Auth y membresía activa en organización activa. OWNER administra invitaciones; SUPERVISOR/REQUESTER conservan las reglas del workflow. | Invitación dirigida a usuario Auth existente; aceptación propia con correo verificado, consentimiento y versión. Una revocación de membresía revoca sus links MCP en la misma transacción. |
| CarrierOperator | Usuario Auth, carrier activo, operador activo/verificado y grant del servidor vigente para ese carrier. Una membresía de shipper o un grant administrativo por sí solos no permiten actuar como carrier. | ADMIN invita/administra operadores. La aceptación propia también requiere el grant independiente del servidor; una invitación no lo concede. |
| McpAccountLink | Usuario, miembro, organización, cliente OAuth y proveedor registrados. `externalSubjectRef` deriva del UUID Auth; `verifiedAt` registra la comprobación del vínculo. | Consentimiento explícito, expiración y revocación propia. Un replay de consentimiento revocado/expirado no lo reactiva. |
| ResponseIntegration | Configuración por carrier, servicio y canal. ADMIN verificado configura; operadores autorizados consultan el diagnóstico. | MANUAL activo documenta al operador. API/MCP permanecen PENDING hasta una verificación externa; configurar una referencia no confirma una conexión live. |

Los roles carrier admitidos son ADMIN, OPERATOR y DISPATCHER. DISPATCHER se limita a ejecución, incidentes, eventos de activos y consolidación. ADMIN es requerido para configuración, administración de operadores, límites y métricas. OPERATOR puede responder oportunidades, emitir/retirar ofertas y confirmar reservas/capacidad. Lectura sigue limitada al propio carrier.

Las membresías anteriores conservan sus datos; `OrganizationMember.verifiedAt` queda desconocido hasta una aceptación propia verificada. No se fabrica evidencia ni se cambia en masa su autorización histórica. Links antiguos sin proveedor, sujeto y verificación dejan de ser utilizables para MCP hasta nuevo consentimiento. Ofertas antiguas permanecen legibles; no se admite un nuevo compromiso comercial sin emisor verificado.

### Lectura de historia y metadatos verificados

El directorio de links también devuelve vínculos históricos. `provider`, `externalSubjectRef` y `verifiedAt` pueden ser `null` en esos registros previos a HAC-41. Esa ausencia no autoriza MCP: la migración de identidad conserva la historia y la autenticación rechaza metadatos no verificados. Un consentimiento nuevo deriva el proveedor del cliente registrado y el sujeto del usuario Auth, y registra su verificación.

Los campos obligatorios del UML describen el vínculo verificado; su lectura histórica requiere esta distinción. No rellenar metadatos desconocidos ni convertir un registro histórico en evidencia de acceso live. La divergencia entre el UML histórico y el DTO de historia debe mantenerse visible en la reconciliación.

## OAuth y linking

El recurso remoto es el `/mcp` HTTPS canónico. Los tokens de usuario son verificados con `Supabase Auth.getUser`, issuer del proyecto, audience/role `authenticated`, expiración y `client_id` exacto. Una sesión normal de contraseña no equivale a un bearer OAuth MCP. El bearer suministrado no vuelve silenciosamente a cookies.

Con `CARGOMESH_MCP_USER_BEARER_ENABLED=true`, el documento de recurso protegido apunta al issuer Supabase `/auth/v1`; las respuestas 401 incluyen el challenge de descubrimiento. El endpoint CargoMesh `/oauth/token` conserva su contrato de servicio `client_credentials`: un token de servicio solo accede a capacidades, no hereda permisos comerciales. La ruta de linking canónica es **`/api/v2/identity/mcp/links`**.

El cliente Auth se registra y se habilita explícitamente en `private.mcp_oauth_clients`, con proveedor y vida máxima. La migración no habilita clientes ni añade usuarios/grants. Registro dinámico desactivado en el perfil local. `provider=OTHER` describe el cliente local de pruebas; no acredita una identidad Alexa externa. `ALEXA_PLUS` solo se usa después de registrar y verificar ese proveedor.

Los scopes OAuth `openid/email/profile` pertenecen al proveedor. `mcp:tools` es el permiso de negocio persistido en el link CargoMesh; el cliente no puede ampliar scopes, elegir otro sujeto o verificar su propio proveedor. La UI de autorización OAuth debe describir el acceso CargoMesh, permitir aprobar/denegar y ofrecer revocación. Su publicación y configuración en el entorno alojado son tareas de conexión del canal; la prueba backend local usa el consentimiento real de Supabase por SDK.

Todo acceso a datos de tools revalida membresía, vínculo vigente y correo actualmente confirmado por Supabase Auth mediante `getUser`. Un usuario autenticado con correo no confirmado recibe 403, aunque el link esté activo; recuperar la confirmación permite reutilizar el vínculo vigente. No se usa la confirmación antigua del link, un JWT previo ni metadata editable como sustituto del estado actual. El principal carrier HTTP funciona sin OrganizationMember. El MCP actual usa un link organizacional; una acción carrier desde MCP exige además su propio CarrierOperator y grant. No se inventa una organización para un usuario exclusivamente carrier.

## Confirmación comercial y reintentos

1. `prepare_v2_commercial_action` valida el mismo payload de dominio que Web y persiste una propuesta privada de cinco minutos. No crea ofertas, reservas ni compromisos.
2. El cliente muestra acción, payload y consecuencias y recoge confirmación explícita del usuario.
3. `confirm_v2_commercial_action` recibe el ID y `confirmed=true`; no acepta reemplazar el payload. Revalida usuario, miembro, organización, cliente y permisos y ejecuta el comando nativo en la misma transacción.

La propuesta incorpora clave UUID y hash SHA-256 del payload canónico. La misma clave con otro payload produce conflicto. Dos confirmaciones concurrentes de la misma propuesta producen un registro y replay determinista. La versión esperada de cada mutación sigue siendo obligatoria; una confirmación no omite guardas de capacidad, oferta, tripulación o estado. Un resultado comercial ya confirmado conserva su recibo para un retry, pero no permite ejecutar bajo una identidad revocada.

El booleano es el contrato entre cliente y servidor; no prueba por sí solo que una persona haya usado una UI. El frontend/cliente debe recoger la decisión del usuario y no confirmar automáticamente por decisión del modelo.

## Emisor y adaptadores

Una oferta MANUAL registra `issuer_operator_id` y `issuer_auth_user_id` derivados de la sesión; la FK compuesta conserva pertenencia al carrier. `source.issuerId` expone el operador, y la fuente/emisor es inmutable. `issuer_member_id` es trazabilidad opcional para una identidad que también tenga membresía; no es requisito para el carrier independiente.

Usuarios ordinarios no pueden afirmar `source.channel=API/MCP`: se exige un adaptador verificado. El CRUD admite únicamente referencias `env://NOMBRE` o `vault://UUID`, nunca una URL con secreto ni una credencial. El diagnóstico devuelve configuración, estado y bloqueo, sin resolver el secreto ni hacer llamadas externas. `liveIntegrationConfirmed=false` es deliberado.

## Localización compartida

Web y MCP consultan el mismo servicio de instalaciones autorizadas y nodos publicados. Texto busca nombre/ciudad; coordenadas buscan candidatos dentro de un radio acotado. Las respuestas incluyen fuentes, versión, truncamiento y NO_MATCH/AMBIGUOUS/CONFIRMATION_REQUIRED. Incluso un candidato único requiere selección explícita; la confirmación reconsulta y rechaza versiones obsoletas o candidatos ajenos.

No se fabrica geocodificación externa. Confirmar devuelve un DTO canónico; no crea una sede ni modifica automáticamente una solicitud. La edición de solicitud reutiliza ese DTO y las validaciones de ubicación existentes.

## Persistencia y límites

Las operaciones usan cliente Supabase con token del usuario y RPC cerrados. Helpers privados y recibos no son accesibles por anon/authenticated/service_role. Las funciones definer tienen `search_path=''` y comprueban actor y alcance antes de acceder a datos o entregar un replay. Las mutaciones HTTP de identidad/carrier mediante cookies exigen origen propio. Sin credenciales se responde 401 antes de comprobar origen; Bearer inválido también devuelve 401 y no cae a la cookie. Una mutación con cookie desde origen ajeno devuelve 403 `FORBIDDEN_ORIGIN`.

La aceptación de este incremento requiere revisión por SHA, pruebas locales y CI. Desplegar migraciones, habilitar OAuth alojado, conectar clientes reales, UI Web y Alexa+ requiere su propia autorización y prueba. El [contrato Alexa/MCP/AWS](./ALEXA_MCP_AWS.md) mantiene los límites de integración y benchmark.

Referencia técnica: [Supabase MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication).
