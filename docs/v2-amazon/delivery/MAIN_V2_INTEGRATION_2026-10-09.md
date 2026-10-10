# Base única main y gate de integración V2 — 9 octubre 2026

## Decisión y manifiesto

Cristhian autorizó adoptar main y probar la integración tras auditar #115/#116. Base: main @ 9197aab50bd6250d9ff8d29627b6861a5657e793; el árbol era idéntico a codex/v2-amazon-contracts @ 424c577. No se requiere volver a integrar esos PR.

Rama de esta transición: codex/main-v2-integration. Target: main. Dueño/aprobador: Cristhian; integrador: sesión Codex autorizada. Registro de Linear pendiente porque no hay conector disponible en esta sesión; no se inventa un ID. Esta transición concreta está autorizada por el usuario. Las ramas nuevas de implementación mantienen su registro habitual.

main es la base activa; codex/v2-amazon-contracts conserva su historial y no recibe nuevas entregas. Los responsables actualizan desde origin/main y abren PR a main, sin push directo ni force-push. PR pendientes contra la base anterior deben revalidarse al cambiar el target.

## Cambio y definición de terminado

- Actualizar instrucciones, skills de integración, índices y plantilla de entrega con la misma base.
- Ejecutar los tres jobs existentes en PR a main, push a main y ejecución manual del workflow.
- Incluir pruebas de conversación y lector/resumen del workflow del chatbot en CI.
- Usar el cliente real del chat contra Next/Hono y Supabase locales: comparar ofertas, reservas y ejecuciones con su proyección persistida, leer confirmación/cancelación y verificar anonimato/tenant ajeno.
- No modificar dominio, migraciones, contraseñas remotas, permisos alojados ni configuración/alias de Vercel.

El smoke usa un dataset sintético V2, identidad real local y HTTP real. El adaptador de prueba lleva el token local en Authorization; no demuestra por sí solo el cookie login en navegador, voz, Bedrock live o Alexa+ live. Un merge a main puede activar el despliegue automático de producción ya configurado; no se modifica esa configuración ni se afirma una validación alojada del chatbot por un build verde.

## Verificación reproducible

Desde cargomesh/:

```sh
pnpm install --frozen-lockfile
pnpm test:v2-conversation
pnpm test:v2-chat-workflow
pnpm release:verify
```

El workflow V2 QA Gate reconstruye la cadena V2, verifica drift y pgTAP, ejecuta scripts/check-hac40-workflow-http-ci.py (incluye chat/API real), y luego el smoke MCP con OAuth PKCE real. V1 se ejecuta como regresión independiente. El resultado se registra por SHA/run del PR, sin asumir los conteos de cortes anteriores.

## Prueba manual pendiente para QA

Sobre el SHA integrado y un entorno local propio con el escenario V2 autorizado:

1. Iniciar sesión como shipper A desde el navegador, crear/recuperar su solicitud y evaluar ROAD.
2. Pedir ofertas, reservas y seguimiento desde el chat. Comparar con los GET y registros persistidos de esa solicitud; oferta no equivale a reserva confirmada, autorización no equivale a confirmación carrier, seguimiento no equivale a GPS live.
3. Verificar que confirmación/cancelación se reflejan al volver a consultar, y que B no lee los registros de A. Sin sesión, el flujo pide login.
4. Registrar actor, SHA, entorno, caso esperado/observado y captura. Voz/Bedrock son casos separados y BLOQUEADO si faltan accesos, no PASS.
5. Dejar bancos locales propios limpios y detenidos. No usar cuentas, grants ni hosted sin autorización específica para esa ejecución.

HAC-42/HAC-43 conservan las pantallas y acciones comerciales pendientes; esta integración no agrega selección, autorización de booking ni operación carrier como comandos de chat. F-02 sigue parcial; usar la clasificación vigente de la revisión UML y distinguir evidencia pendiente, documentación y defecto funcional confirmado.

## Estado de ejecución

Diff y gates se verifican antes del merge. La evidencia final de PR, SHA y CI se adjunta al cierre de la sesión y al reporte local; este acta describe el procedimiento y no convierte pendientes humanos/UML en PASS.
