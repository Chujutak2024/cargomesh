# HAC-43 — fricción local de validación visual, 8 octubre

## Entorno y workaround

El producto real a 8083 mantiene autenticación y fuente API. Sin configuración local de Supabase/sesión/grants/dataset no puede demostrar el flujo positivo. `/freight-request/new` falla durante SSR por variables locales requeridas ausentes; workspace comunica falta de sesión. No se añaden secretos, fallback empresarial ni permisos ficticios al producto. Owner: entorno/QA y dueño del flujo shipper para el smoke autenticado.

Se conserva evidencia visual separada en una copia externa `/qa-hac43`, puerto 8085: **datos sintéticos, en memoria, sin persistencia**. No contiene .env, no existe esa ruta en el producto y no demuestra RLS/E2E. Google positivo no verificado ahí; fallbacks y selección sí. No hay Supabase remoto/modificación de infraestructura.

El árbol de node_modules estaba enlazado a otra copia. Para instalar Three/R3F/Motion sin tocarla, se retiró únicamente el enlace verificado y se creó un árbol aislado. El pnpm global rechazó scripts desde esa junction; se ejecutaron comandos leaf reales de package.json con Node/tsx y argumentos estructurados. Logs/TAP permiten reproducir la equivalencia, sin afirmar ejecución del comando agregado pnpm.

## Defectos encontrados y corregidos

- Fade del contenido producía contraste transitorio insuficiente: opacity del texto siempre 1; solo translate/scale del contenido. Matriz inicial se conserva; final sin violaciones automatizadas.
- Liberación normal de Canvas disparaba fallback: listener de pérdida de contexto retirado al desmontar. Verificado poster/0 canvases fuera de vista → WebGL/1 canvas al volver; fallo explícito conserva fallback.
- Dos entradas potenciales al abrir intake: se retiró la entrada CSS antigua del cardBody; Motion controla el cambio de página/paso.
- CSS de emulación reducida del harness provocó mismatch SSR/client: se difiere hasta ready. No se modificó el producto para ocultarlo.
- datetime-local fill no actualizó todos los valores React: controles nativos AX usados para QA, con lectura de estado y validación vigente. No se alteraron valores por evaluate.

## Límite pendiente

Three.Clock genera un warning desde Fiber; no error de WebGL. No se parchea vendor. No hay benchmark FPS/memoria GPU/CWV ni certificación WCAG completa. El envío/persistencia/versionado positivo necesita entorno local autorizado y smoke conjunto. Las suites de código no convierten este BLOCKED en PASS.

Push, PR, merge, despliegue, main, Vercel, hosted Supabase, Linear y Drive: sin cambios.
