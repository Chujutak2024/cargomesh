# Nova: respuesta completa, captura por voz y confirmación

Fecha: 21 octubre 2026. Base del PR: main `0d35336`; la validación inicial partió de `f8da076`. Publicación del PR autorizada por Axel; merge y despliegue siguen separados.

## Petición y resultado implementado

El usuario informa que una respuesta se cortó cuando apareció un formulario. Solicita recoger y corregir casi todos los datos por voz y mostrar únicamente la revisión/confirmación cuando corresponda.

- El navegador distingue el fin del texto, el fin de respuesta del proveedor y el final audible de la cola PCM. Una desconexión o error no descarta el audio que ya recibió: primero lo reproduce y después cierra o renueva la sesión.
- El gateway proyecta `bidi_response_start` / `bidi_response_stop`, eventos comprobados en la versión instalada de Strands, como `response_start` / `response_end`.
- Mientras Nova habla, el navegador envía PCM silencioso en lugar de captar el micrófono. Esto permite terminar la intervención antes de escuchar otra respuesta y reduce interrupciones por eco. Un `barge_in` no descarta la cola de audio recibida.
- El límite normal de 240 segundos permite hasta 45 segundos adicionales para terminar una respuesta ya en curso. No es una sesión ilimitada. Si no termina en ese margen, se notifica respuesta incompleta. Un fallo de red/proveedor no permite recuperar audio que nunca llegó; no se promete lo contrario.
- Las órdenes «revisa el resumen» y «quiero corregir» son distintas de «confirmo guardar el borrador». Un «sí» aislado no guarda ni reserva. Las órdenes de revisión y guardado esperan al final audible de la respuesta actual y a la validación pendiente de los datos.
- La aprobación está ligada a una instantánea del borrador, ID/versión de solicitud y caduca a los cinco minutos. Cualquier cambio exige revisar nuevamente los valores actuales. Los servicios nativos mantienen autenticación, idempotencia, versiones y límites comerciales.
- Fechas, rango horario, producto/categoría revisada, datos básicos y contactos pueden aclararse por voz. Los valores se validan contra el catálogo y las reglas existentes; no se elige entre fechas alternativas, no se inventa país de un teléfono ni se confirma peligrosidad/documentación a partir de una sugerencia tentativa.
- «De la mañana» se interpreta como horario, no como el día de mañana. Una nueva fecha o día incompatible no hereda una fecha propuesta antes.
- Las aclaraciones no abren campos manuales durante el modo de voz. El acceso manual queda como una opción explícita. El resumen muestra los valores actuales, sin exigir completar un segundo formulario.
- Las correcciones más recientes de ruta prevalecen sobre las anteriores; un peso por unidad no se presenta como un total contradictorio.

## Verificación local

Desde `cargomesh/`:

```powershell
pnpm test:v2-conversation
pnpm test:v2-chat-workflow
pnpm typecheck
pnpm check:architecture
pnpm build
```

Suites de conversación, workflow y tipos: PASS. Regresiones focales adicionales de reproducción/fechas/contactos: PASS. La compilación final terminó con exit 0; lint, tipos, generación de páginas y build PASS.

Desde `cargomesh/voice-pilot/`:

```powershell
.\.venv\Scripts\python.exe -m unittest test_nova_voice_gateway test_voice_guidance test_voice_transport_limits test_voice_response_finish
```

Resultado observado: 22 pruebas PASS. Incluye el caso en que vence el límite normal mientras una respuesta sigue en curso: `response_end` debe preceder al cierre. Los tests del componente usan micrófono, socket y audio inertes; no acreditan una conversación humana con Nova ni Alexa+ live.

## Prueba de aceptación humana

1. En una sesión Client autorizada, iniciar Nova y describir origen/destino, producto, cantidad y peso por unidad usando el catálogo disponible.
2. Dar las dimensiones de cada unidad y corregir un dato. Nova debe continuar con una pregunta útil, sin abrir el formulario ni perder el resto.
3. Aclarar recojo/entrega con fecha exacta y horario. Ejemplo: «Recojo el 25 de octubre de 2026 de nueve a once de la mañana». La fecha debe ser válida para el caso de prueba actual.
4. Dictar contactos. Ejemplo de formato de correo: «maria arroba example punto com». Un teléfono debe incluir los dígitos del país; el sistema no los inventa.
5. Decir «revisa el resumen». Escuchar completa la intervención de Nova; el resumen debe aparecer después del audio, sin cambiar a un formulario.
6. Decir «quiero corregir» y cambiar cantidad/peso. El resto de datos permanece y la aprobación anterior deja de servir.
7. Pedir nuevamente «revisa el resumen». Cuando estén completos y revisados los campos, decir «confirmo guardar el borrador» o usar el botón explícito. Si hay datos pendientes, no debe persistir.
8. Verificar el recibo nativo. Guardar un borrador no solicita cotizaciones, selecciona ofertas ni autoriza reservas.

## Despliegue y límites de evidencia

La publicación en GitHub mediante PR a main fue autorizada por Axel. Este cambio no despliega manualmente Vercel ni AWS. La web y el gateway requieren desplegarse para habilitar todos los eventos nuevos. Se conservan los límites de auth de 64 KiB y audio de 8192 bytes, JWT/uso único, IAM, secreto, origen y recursos existentes.

La última prueba real del gateway alojado aceptó 2057 bytes y rechazó 5007 bytes con 1008 antes de ready; no se presenta este incremento local como una reparación ya alojada. La identidad AWS renovada carece de `ecs:DescribeServices`; no se cambió IAM. Véase el friction log `NOVA_GATEWAY_RETEST_2026-10-21.md` antes de planear el rollout. El catálogo extendido no se habilita hasta confirmar el despliegue y el handshake ampliado.
