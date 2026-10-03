# Correspondencia de fixtures HAC-27 con los escenarios V2

Los ocho JSON de esta carpeta son ejemplos sintéticos del DTO. Esta correspondencia es explícita; los ejemplos no son capturas del API ni un seed adicional. Los UUID de referencia se preservan para no cambiar los fixtures ya consumidos. Para un recorrido real, obtener sedes/opciones del API, crear la solicitud y usar el ID devuelto. Nunca sustituir únicamente un UUID dejando el snapshot ilustrativo de Callao: la sede del baseline está en Lima y su snapshot debe volver a resolverse en el servidor.

| Referencia ilustrativa | Correspondencia en escenario / regla |
|---|---|
| `11111111-2222-4333-8444-555555555555` | Sede de origen `c2330000-0000-4000-8000-000000000001`, QA-A-LIMA; label, ciudad y coordenadas del JSON son ilustrativos, no atributos del seed. |
| `66666666-7777-4888-8999-000000000000` | Sede destino `c2330000-0000-4000-8000-000000000002`, QA-A-AREQUIPA; reconstruir snapshot desde la sede. |
| `8f5b7d42-3c1a-4b9e-8d2f-1a2b3c4d5e6f` | Tenant `c2300000-0000-4000-8000-000000000001`, resuelto desde sesión, nunca confiado desde navegador. |
| `c1000000-0000-4000-8000-000000000001` | Carrier elegible `c2340000-0000-4000-8000-000000000001`. |
| `d2000000-0000-4000-8000-000000000001` | Servicio cubierto `c2360000-0000-4000-8000-000000000001`. |
| `e3000000-0000-4000-8000-000000000001` | Lane dirigida `c2380000-0000-4000-8000-000000000001`. |
| `f4000000-0000-4000-8000-000000000001` | Activo `c23d0000-0000-4000-8000-000000000001`, requiere además escenario `v2-hac12-road-capacity`. |
| `a5000000-0000-4000-8000-000000000001` | Calendario `c23f0000-0000-4000-8000-000000000001`, requiere escenario de capacidad. |
| `c1000000-0000-4000-8000-000000000002` | Carrier sin evidencia de capacidad `c2390000-0000-4000-8000-000000000001`. |
| `d2000000-0000-4000-8000-000000000002` | Servicio UNKNOWN `c23a0000-0000-4000-8000-000000000001`. |
| `e3000000-0000-4000-8000-000000000002` | Lane UNKNOWN `c23c0000-0000-4000-8000-000000000001`. |
| `f4000000-0000-4000-8000-000000000002` | Cupo `c23e0000-0000-4000-8000-000000000001` del servicio UNKNOWN `c23a0000-0000-4000-8000-000000000001` y carrier `c2390000-0000-4000-8000-000000000001`; requiere escenario `v2-hac12-road-capacity`. El cupo existe, pero no tiene calendario asociado en ese seed: la disponibilidad permanece UNKNOWN (`calendarId: null`), no confirmada por sus límites nominales de peso/volumen. |
| `c1000000-0000-4000-8000-000000000003` / `d2000000-0000-4000-8000-000000000003` | Caso ilustrativo rechazado; **no son un tercer carrier/servicio del seed**. El negativo canónico usa origen Piura `c233…003` o dirección inversa y devuelve cero candidatos; no esperar el candidato rechazado ilustrativo en esa respuesta real. |
| `a9c4e112-84b1-47d0-91e3-52f8c7a6b501` | ID de solicitud de ejemplo, sin fila sembrada. Sustituir por el ID obtenido en POST para GET y serviceability. |
| `6c84fb90-12c4-11e1-840d-7b25c5ee775a` | Clave de intento ilustrativa; generar un UUID estable por intento y conservarlo en reintentos. No referencia una entidad del seed. |
| `c0000000-0000-0000-0000-000000000001` a `…008` | Coinciden con las ocho categorías de la migración de referencia `20260927042811`; no pertenecen al namespace c230–c23f de datos de escenario. |

Los códigos, nombres comerciales, geometría y fechas ilustrativos tampoco prueban valores de BD. El backend actual devuelve `routePreview: null`; la traza SIMULATED del ejemplo elegible sirve para desarrollar el mapa, sin anunciar geometría persistida o live. El namespace c230–c23f es el canónico para organizaciones, sedes, carriers, servicios, lanes y capacidad del escenario, sin extenderlo con entidades inventadas por estos JSON.
