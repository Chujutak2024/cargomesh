# Selector de camión 3D — mejora local

## Alcance

Actualización de «Camión preferido» en Solicitud local y Revisión de la pantalla actual `/v2-workspace`. Se conserva el borrador compartido; no se modifican el API, contratos de flota, Google Cloud ni la persistencia empresarial.

## Diseño implementado

- Cinco modelos originales con geometría diferente: rígido, tracto con remolque, refrigerado, plataforma y volquete. Three.js y React Three Fiber ya estaban instalados; no se añadió una biblioteca.
- Tarjetas con nombre, carrocería, marca de selección, foco visible y elección mediante botón accesible.
- Se elimina el desplegable repetido «Preferencia». «Sin preferencia» sigue disponible como botón.
- Una única tarjeta «Mi camión» reúne el cuadro de subida, vista previa de la foto y modelo. El archivo nativo se mantiene accesible mediante teclado.
- Foto opcional JPG/PNG/WebP hasta 8 MB; compresión local hasta 800 px y límite de almacenamiento existente. Una selección inválida no reemplaza la foto guardada. La subida se bloquea mientras se procesa y no aplica un resultado después de desmontar el control.
- La elección y la foto son preferencias locales, sin confirmar un vehículo de flota, capacidad o reserva.

## Render y recursos

En escritorio, los cinco modelos se renderizan en WebGL al entrar en la vista. Se usa render a demanda y se desactivan sombras en las miniaturas. Se conservan reduced motion, límites de DPR y liberación de geometrías/materiales. El componente del Panel sigue usando la variante de tracto con remolque.

En móvil se usan imágenes renderizadas desde esos mismos modelos originales, sin mantener cinco contextos WebGL. También sirven de respaldo si no puede renderizarse la escena. No son imágenes externas ni fotos de vehículos asignados.

Las imágenes `public/v2-workspace/trucks/*-3d.png` se obtuvieron de la escena real del navegador. La captura completa y los rectángulos DOM están en la carpeta externa de evidencia; se extrajo la región de cada modelo sin el distintivo superpuesto. La API de captura por región no produjo una región fiable, por lo que se extrajeron los píxeles del render completo guardado. No se usaron imágenes generativas como sustituto de esos modelos.

## Verificación

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Geometría / borrador | PASS 12/12 | `tests.log`: tres pruebas de geometría, liberación de recursos y diferenciación de carrocerías; nueve de conservación/validación del borrador. |
| Typecheck | PASS | Ejecución directa del script de TypeScript del proyecto, salida 0. |
| Build | PASS | `build.log`, Next 15; build utilizado por los accesos actuales. |
| Arquitectura / diff check | PASS | `architecture.log`; sin errores de whitespace. |
| Escritorio | PASS | Cinco escenas con `data-truck-state=webgl`, confirmadas en Opera. `truck-selector-final.png`. |
| Elección por teclado y recarga | PASS | Enter en Volquete, selección visible; la selección permanece al recargar. Se esperó el estado seleccionado antes de recargar. |
| Foto y modelo | PASS | En Codex IAB se utilizó una imagen ilustrativa del proyecto y un modelo rotulado como prueba local. Ambos sobrevivieron a la recarga con las fechas conservadas. `truck-photo-qa.png`; no es evidencia de una foto real del usuario. |
| Móvil 390 × 844 | PASS | Cinco imágenes cargadas, cero Canvas, un solo input de foto y ancho del documento ≤ viewport. `truck-selector-mobile.png`. Ajuste temporal de viewport retirado. |
| Datos del usuario | PASS | Opera conserva Callao → Piura, 10 × 800 kg, fechas originales, progreso 1/5, camión personalizado todavía sin modelo ni foto. Las pruebas de edición se hicieron en Codex IAB y se restauró la copia allí al finalizar. |

Evidencia externa y copia previa de los seis archivos modificados: `D:/Documents/hackaton 2/cargomesh-v2-truck-3d-20261008/`.

URL actual: `http://127.0.0.1:8080/v2-workspace#/request`.

Skills aplicadas: `professional-project-orchestrator` para acotar esta mejora y `react-best-practices` para conservar el estado y los recursos del render.

Sin commit, push, PR, merge, despliegue ni cambios remotos.
