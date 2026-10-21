# Cliente · motion del asistente — 21-oct-2026

Alcance: presentación en `main`, con publicación autorizada explícitamente por el usuario.
Sin cambios de contratos, auth, catálogo, interpretación, guardado, cotizaciones o reservas.
Referencia: video proporcionado por el usuario. El subtítulo del encabezado del chat se retira
por petición del usuario; se conserva el nombre CargoMesh Copilot.

## Comportamiento

- Bienvenida visual del bot en el centro; viaja a la burbuja inferior derecha al estar
  lista la página y terminar la lectura inicial del catálogo. Espera visual mínima de
  2100 ms y límite de 3200 ms: no bloquea la página ni representa progreso del servicio.
- La presentación inicial añade una burbuja bilingüe de CargoMesh y ojos sonrientes:
  un salto finito de 950 ms, seguido de una pausa quieta para leer antes del viaje.
- Abrir directamente el sidebar desde la burbuja. En escritorio amplio, panel y contenido
  comparten una transición de 560 ms; en móvil, el chat ocupa la pantalla completa.
- El icono de escribir conserva el compositor rápido. Se mantienen arrastre por puntero,
  flechas, Inicio, desacoplado/acoplado y nueva conversación.
- Bot con mirada limitada al cursor, brillo de procesamiento y parpadeo. Las posiciones
  usan motion values y un callback de animación por frame, sin actualizar el formulario.
- Entradas por opacidad/desplazamiento de mensajes y bloques. Las actualizaciones de un
  mismo mensaje de voz no vuelven a montar la fila. El cierre conserva el panel durante
  su salida y lo vuelve inerte para impedir clics/foco en controles que están desapareciendo.
  El contenido Nova se desmonta al empezar el cierre, sin esperar la salida visual.
- Al abrir, mascota, título y primer saludo suben 32/26/24 px por separado, con
  retrasos escalonados de 180/320/460 ms. La revisión aparece al final de la secuencia.
- La preferencia `prefers-reduced-motion` omite bienvenida, desplazamientos y animación
  decorativa; la mirada se centra también en dispositivos sin puntero preciso.

## Validación

- `pnpm typecheck`, `pnpm check:architecture`, `pnpm build`.
- `pnpm test:v2-chat-workflow`: 57 pruebas, incluida mirada acotada, movimiento por teclado,
  orden del saludo, preferencia de movimiento reducido y tiempo finito de presentación.
- `pnpm test:v2-conversation`: 87 + 6 pruebas (captura, contexto, ciclo de voz y limpieza al cerrar).
- `node --import tsx --test src/features/product-motion/use-motion-preference.test.ts`:
  2 pruebas de hidratación y preferencia de movimiento.
- Navegador local: entrada central → esquina, apertura/cierre, desacoplado sin perder
  texto y captura de Lima → Arequipa en el borrador compartido (2/6), sin crear solicitud.
- Vista móvil 390 × 844: panel 390 × 844 y sin desbordamiento horizontal; resumen
  desplegable y compositor rápido siguen disponibles.
- Compositor a 320 × 568, panel con altura reducida 844 × 390 y arrastre de la burbuja
  en escritorio. El cierre devuelve el foco al botón del asistente.
- Refinamiento del saludo: captura de fotogramas confirma opacidad 0 → 1 y desplazamiento
  vertical 32/26/24 → 0 en orden. La burbuja inicial cabe a 390 × 844 sin desbordamiento.
  Cerrar y reabrir rápidamente conserva el texto sin enviar y mantiene un solo panel.

El comportamiento de las aclaraciones de fechas/clasificación preexistentes no cambia.
Las pruebas de voz automatizadas no sustituyen una prueba manual de micrófono/Nova.
