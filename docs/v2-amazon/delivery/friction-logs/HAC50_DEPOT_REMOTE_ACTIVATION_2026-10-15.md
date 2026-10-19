# HAC-50 — Activación de operaciones de sede

Fecha: 2026-10-15. Estado: pendiente de autorización/conexión; no es un error del login ni del mapa.

La aplicación activa usa Supabase `yhimeajpzicjbxpbzsyh`. El plugin conectado enumera `tokvzfrefwqobzqgbfoj` (llamado cargomesh) y otro proyecto inactivo. Una comprobación de estructura en el primero confirma que no contiene drivers, transport_executions ni el gate de identidad esperado. No se aplicó migración ni se cambió la configuración de la app para apuntarla allí.

La migración `20261015055541_hac50_depot_operations.sql` está preparada y probada con 43 pgTAP y dos carreras de sesiones reales en bancos Docker aislados. El RPC remoto ausente responde `503 DEPOT_OPERATIONS_NOT_INSTALLED`; la UI mantiene catálogo/cobertura y muestra el pendiente explícito. Conductores/agenda utilizan los endpoints ya instalados.

Resolución: autorización específica exigida por AGENTS.md y acceso de administración al proyecto realmente configurado. Antes de aplicar: verificar referencia, prerequisitos, historial de migraciones y ausencia de nombres en conflicto; después verificar RLS, RPC autorizado, escritura sintética versionada y estado visible. No aplicar seeds SQL de pruebas al proyecto alojado. La autorización se solicitó mediante pregunta pendiente; el tiempo transcurrido no constituye aprobación.

Otro incidente de verificación: el navegador se interrumpió durante una recarga final. El front se reinició en el mismo checkout y se confirmó listener 127.0.0.1:8080 y login HTTP 200. Se conserva evidencia de alta/revisión y disponibilidad visual anterior. No certificar responsive final ni E2E remoto de sede por esta recuperación.
