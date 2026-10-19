# HAC-50 — primer incremento conectado de flota

14 de octubre de 2026, America/Lima. Implementación local sobre `codex/unified-workspaces-demo-boundary`, base publicada `cbb10ff`. No se publicó este incremento ni se modificó main.

## Resultado

- Entrada principal de Fleet conectada a la sesión y sus carriers autorizados. Selección de servicio ROAD; no requiere copiar UUIDs.
- Catálogo de vehículos con búsqueda, ficha, alta y revisión para ADMIN. Referencias de sede y socio se seleccionan del catálogo autorizado.
- Formulario usa el contrato existente de assets: código, placa, marca/modelo, equipo/carrocería, función portadora/auxiliar, capacidad/volumen, dimensiones, peso bruto, odómetro, registro, ejes, variante, estado, sede, procedencia/socio y referencia de evidencia. Valores opcionales existentes se conservan en revisiones.
- Directorio de conductores conectado en lectura. Licencia, vencimiento, cualificaciones, estado y experiencia proceden de los registros; no usa perfiles ni métricas de stock.
- Sedes registradas conectadas en lectura. Asignaciones, cobertura/lanes y edición de conductores se señalan como pendientes.
- Árboles React distintos para Connected y Demo. El demo explícito conserva doce camiones y sus escenas; sus hooks/localStorage no respaldan el catálogo conectado.

## Fallo corregido

El lector anterior enviaba consultas de catálogo a `/api/v2/carriers/:id/...`, protegidas por identidad de organización. La cuenta Carrier de validación recibe `403 FORBIDDEN_TENANT` allí. La fachada `/api/v2/carrier-portal/carriers/:id/...` responde correctamente bajo el grant Carrier. Se reutilizó esa fachada, sin relajar autenticación, RLS o permisos y sin crear endpoints redundantes.

No se detectó un hueco estructural necesario en backend para el alta/revisión de vehículos de este incremento. Los endpoints existentes comprobaron persistencia, versiones e idempotencia en el entorno alojado. Eso no acredita asignación operativa, capacidad confirmada, GPS o routing live.

## Evidencia

- Prueba inicial autorizada: seis activos y cuatro conductores en el carrier sintético existente; consultas correctas 200, consultas de organización 403.
- Navegador: creación de `HAC50_UI_1792035994881`, placa sintética, estado OUT_OF_SERVICE y nota de validación no operativa. Recarga conserva el registro; edición del modelo desde frontend conserva versión 2 tras otra recarga.
- HTTP alojado: revisión adicional de la misma unidad pasa a versión 3; reintento idéntico devuelve esa misma versión; versión antigua y clave reutilizada con payload distinto responden 409; los rechazos no alteran el registro. Consulta anónima 401. 8/8 verificaciones; ver `persistence-results.json`.
- La unidad sintética permanece identificada, fuera de servicio. No se borraron registros ni se modificaron vehículos operativos, usuarios o grants. No hubo migraciones.
- 37/37 pruebas de cliente, mapper, permisos, catálogo y API. TypeScript limpio (`--incremental false`) y arquitectura pasan: 371 módulos, 97 entradas cliente observadas.
- Navegador: cuatro tarjetas de conductores, salida y retorno al demo de doce camiones, registro/cancelación sin escritura adicional, siete unidades conectadas después de añadir la prueba.
- Responsive: 1366×768 y 390×844. Se corrigió overflow de códigos sintéticos largos; listado y formulario móvil sin overflow horizontal. Scroll funciona.
- Credenciales/cookies solo en memoria de las verificaciones; no se incluyen en el informe ni se modificó `.env.local`.

## Pendientes y fuente responsable

| Dato o tarea | Backend actual | Frontend de este incremento |
| --- | --- | --- |
| Activos ROAD y sus atributos canónicos | Disponible y probado | Lectura/alta/revisión conectadas |
| Conductores: nombre, licencia, estado, experiencia, cualificaciones | Disponible y leído | Directorio conectado; edición pendiente |
| Conductor: zona horaria de licencia, agenda, límites y consumo de jornada, evidencia | Disponible en contrato | Presentación detallada y edición pendientes de la siguiente etapa |
| Sedes registradas | Disponible y leído | Lista conectada; administración pendiente |
| Calendarios, reservas, mantenimiento, reposicionamiento y asignaciones | Contratos/endpoints existentes | Flujo operativo/agenda pendiente; no se confirma disponibilidad |
| Áreas y lanes dirigidas | Contratos/endpoints existentes | Conexión pendiente; no se deduce cobertura desde sedes |
| Combustible, velocidad, score de condición y GPS | Sin fuente telemétrica verificada en este incremento | Marcados pendientes; ningún dato sintético sustituye lecturas reales |
| Puntualidad, viajes y retrato real del conductor | Requieren fuente/historial verificados | Pendientes; no se muestran estadísticas ni retratos de demo como reales |
| Año de modelo, vencimiento de seguro e inspección de la ficha local | Sin campo equivalente en el payload canónico de assets inspeccionado | Pendientes de contrato/backend si se incorporan al alcance; no se envían como campos desconocidos |

## Siguiente incremento

Alta/edición y ficha completa de conductores; luego asignaciones por ejecución y ventana con agenda/reservas/mantenimiento. Finalmente conectar cobertura y mapa con posiciones fechadas y geometría calculada por proveedor.

Archivos principales del checkout activo: `connected-fleet.tsx`, `connected-fleet-client.ts`, `connected-vehicle-form.tsx`, `connected-fleet.module.css`, `connected-fleet.test.ts`, `fleet-client.ts`, `fleet-workspace.tsx`. Script de pruebas: `test:connected-fleet`. Los archivos visuales concurrentes permanecen conservados. No reutilizar los scripts one-shot de esta carpeta como instalador.

## Fuentes consultadas

Contratos y código locales de CargoMesh V2: assets/fleet, crew, catálogo, recursos del portal y middleware de identidad. Documentación de [sesiones SSR de Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client) revisada; se preservó el cliente/validación de sesión existente. El endpoint Markdown del changelog no fue legible por el navegador de investigación; no hubo cambios a SDKs ni configuración de Supabase.
