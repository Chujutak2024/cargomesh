# Nova gateway: repetición controlada en AWS

Fecha observada: 21 octubre 2026, 12:19 America/Lima (17:19 UTC).
Checkout local: `f8da07678cdd1a27190affdce24794c48c38bdc1`.

## Resultado real

Se abrió una sesión Client mediante el endpoint de demostración nativo del sitio. Los permisos se obtuvieron con `preview=false` desde `https://cargomesh.vercel.app` y se enviaron al gateway público configurado, con el mismo Origin HTTPS.

| Caso | Grant HTTP | Sobre auth UTF-8 | ready | Cierre |
| --- | --- | --- | --- | --- |
| Sin historial | 200 | 2057 bytes | Sí | 1000, cierre voluntario |
| 12 turnos diagnósticos sintéticos acotados | 200 | 5007 bytes | No | 1008 antes de ready |

Esto reproduce el defecto descrito en PR #140. La autenticación del cliente y el acceso inicial funcionan; el gateway desplegado todavía rechaza el sobre ampliado. No se considera superada la aceptación del rollout de 64 KiB. El resultado es compatible con el límite anterior, pero no identifica por sí solo el digest de la imagen.

No se enviaron frames de audio ni comandos comerciales. No se crearon pedidos, cotizaciones o reservas. Cookies y tokens permanecieron solo en memoria y no se imprimieron ni guardaron. El historial diagnóstico no contenía datos de usuario.

## Identidad y bloqueo de inspección AWS

La renovación fue correcta: el perfil `cargomesh-bedrock` tiene sesión válida en la cuenta prevista. `ecs:DescribeServices` devuelve AccessDenied porque la identidad no tiene una política que permita esa acción sobre `service/default/cargomesh-nova-staging`.

No se cambió IAM ni se intentó ampliar permisos. La imagen, digest y revisión actualmente ejecutados siguen sin verificarse por ECS. No se construyó/publicó imagen ni se actualizó el servicio durante esta prueba. No se modificaron variables ni despliegues de Vercel.

## Siguiente aceptación

Con un acceso autorizado al servicio ECS existente, desplegar la imagen del corte aprobado que incluya los tres archivos del Dockerfile.gateway. Mantener IAM, secreto, origen, puerto e infraestructura existentes. Registrar task definition, imagen por SHA y digest real.

Después del rollout, repetir este diagnóstico: tanto 2057 bytes como un sobre mayor a 4096 bytes deben alcanzar ready y permitir cierre voluntario 1000. Solo después corresponde habilitar el catálogo extendido en Vercel y verificarlo. La prueba humana de voz y Alexa+ live siguen separadas de esta aceptación de transporte.

Evidencia sin secretos: `nova-hosted-transport-result.json`, junto a este documento. Script reproducible: `nova_hosted_transport_probe.py`, en la misma carpeta.
