# HAC-43 — friction log del entorno local

## Snapshot

Fecha de inicio: 7 oct 2026. Base `codex/v2-amazon-contracts@50c12d115dd9b2171d9375acd215593de29e8f34`. Worktree separado, sin commit/push/merge. Las evidencias finales pueden tener timestamp UTC del 8 oct; deben leerse con zona America/Lima.

## Bloqueos y workarounds

| Situación | Evidencia / impacto | Decisión | Estado |
| --- | --- | --- | --- |
| Docker no disponible | No puede iniciarse Supabase local; no hay pgTAP ni round trip positivo con DB | No instalar Docker ni sustituir por Supabase remoto | BLOCKED |
| Sin sesión V2 ni grant carrier local | GET reales freight/opportunities responden 401 con envelope V2; UI mantiene error/acceso | No bypass de auth, no credenciales ficticias; HAC-41 debe habilitar sesión/discovery | BLOCKED |
| Dependencias mediante junction de otra copia local | `pnpm test:release` se detiene con `ERR_PNPM_UNSAFE_MODULES_DIR` antes de tests | Ejecutar los mismos 21 scripts hoja con npm; 572/572. No instalar/eliminar el árbol compartido | WORKAROUND LOCAL |
| Control de navegador perdido al cambiar runtime | No se podían inspeccionar pantallas nuevas en ese segmento | Recuperado después con `cua_repl` del navegador integrado. QA aislada posterior y capturas; ningún navegador externo utilizado | RESOLVED |
| Google rechaza el origen de QA | Consola: `RefererNotAllowedMapError` para el puerto 8084 de QA | No ampliar permisos de la clave ni modificar Cloud. UI muestra proveedor no disponible y conserva listas/procedencia; no inventa mapa/route | BLOCKED POSITIVE RENDER EN QA |
| Rail contraído con link más ancho que el área visible | Clic automático no navegaba; teclado sí. DOM reveló ancho mínimo del grid item fuera del rail | `width:100%;min-width:0;overflow:hidden` en enlace; revalidar clic/keyboard/móvil | CORRECCIÓN LOCAL |
| Google muestra su error dentro del host fallido | AX incluía mensaje técnico debajo de la UI de fallback | Ocultar solo el host fallido; en renderer válido conservar toda atribución Google | CORRECCIÓN LOCAL |
| ROAD conservaba sustitución automática por OSM | La inspección del DOM de QA detectó el proveedor alternativo ante fallo de Google | Retirar la sustitución automática; conservar contexto y mensaje honesto. 20 casos de null/zero/legs vacíos/coordenadas/selección pasan sin inventar geometría | CORRECCIÓN LOCAL |
| Transiciones del rail/intake reducían contraste temporalmente | QA detectó texto atenuado durante animación | Conservar movimiento breve sin fade de texto; 196 muestras finales sin infracciones Axe ni overflow raíz. 14 pares de paleta pasan; no equivale a certificación WCAG completa | CORRECCIÓN LOCAL |

## Interpretación de evidencia

El harness de UI vive fuera del repositorio, señala **DATOS SINTÉTICOS EN MEMORIA — SIN PERSISTENCIA** y tiene una copia aislada del frontend. Un alta/revisión o 401/403/409/500 de ese harness demuestra el comportamiento del cliente; no demuestra auth/RLS, mutación persistida, flota real ni oferta atribuible recuperada por el shipper.

El servidor de producto no contiene esa ruta QA. Los logs de navegador guardados eliminan claves; las variables locales no se incluyen en el snapshot. No se utilizaron servicios alojados de Supabase ni se cambiaron Linear, Vercel o producción.

## Acciones para destrabar

1. Axel/HAC-41 y QA: proporcionar sesión/grant y dataset local autorizado, con Docker/Supabase disponibles.
2. Juan + Luis: smoke carrier→oferta→consulta shipper, expectedVersion y aislamiento entre tenants sobre el mismo SHA.
3. QA local: permitir un origen ya autorizado para Maps o configurar una restricción localhost específica mediante autorización separada; no ampliar acceso automáticamente.
4. Preparación de PR futura: dependencias normales sin junction y gates completos; la aprobación de manifiesto y publicación siguen pendientes.
