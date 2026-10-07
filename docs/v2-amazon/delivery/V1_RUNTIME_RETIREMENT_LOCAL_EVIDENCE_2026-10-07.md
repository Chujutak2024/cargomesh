# Retiro de runtime V1 y prueba manual V2 — 7 oct 2026

## Corte, autorización y alcance

Cristhian pidió retirar lo que ya no usa el producto y realizar una prueba manual. Rama existente registrada en HAC-40/HAC-39: `codex/v2-full-backend`, target `codex/v2-amazon-contracts`. Base `50c12d115dd9b2171d9375acd215593de29e8f34`. El SHA de entrega y CI se registra en el PR correspondiente y Linear.

El PR #108 había promovido exactamente ese árbol a `main`; esa promoción conservaba entradas V1 activas. Esta entrega corrige el runtime y prepara un corte revisable. No demuestra que la limpieza ya esté integrada a `main`.

## Cambios

- Retirados directorio `/providers`, despacho V1, tracking con ID de demo, booking V1, JudgeDrawer y sus servicios, fixtures, bridges y pruebas de WebMCP.
- Retirados POST antiguos de bookings, orchestration, freight-requests, preferencias V1 y demo-login. La API canónica `/api/v2/` se conserva.
- Dashboard, solicitudes, detalle, organización, reservas y seguimiento leen servicios/repositorios V2 con actor autorizado. La lista de solicitudes filtra contrato `2.0` y organización; los listados de reservas y ejecuciones usan el workflow V2.
- Login por correo/contraseña con membresía activa; logout explícito. Mutaciones de sesión rechazan origins externos. Se corrige la normalización loopback de Next sin aceptar autoridades externas ni otro puerto.
- MCP registra únicamente las cinco tools V2 implementadas. El perfil V1 no se habilita; las capacidades comerciales MCP pendientes se declaran parciales.
- Retirados documentos V1/transicionales del árbol, cinco scripts antiguos y placeholders vacíos. El historial se consulta en `feef2419fa5f786c9a6063f85aeee452dd9eb84b`.
- Conservados componentes UI compartidos, workspace/previews V2, conversación V2, contratos, UML, DER, migraciones aplicadas, escenarios y gates SQL. El renombrado del CSS de login conserva sus estilos útiles.

El [inventario de archivos retirados](./V1_RUNTIME_RETIREMENT_FILES_2026-10-07.csv) enumera 293 rutas anteriores: 238 de source (incluido el CSS renombrado), 49 documentos/fixtures históricos, cinco scripts y una respuesta antigua. Este inventario describe el delta, no una eliminación indiscriminada por nombre.

## Ejecutado localmente

Aplicación `http://127.0.0.1:3172`; Supabase del proyecto local `cargomesh-v2-local`, API puerto 58321. Escenario explícito `supabase/scenarios/v2-road-baseline/seed.sql`, actores sintéticos A y B. El volumen local tenía 17 migraciones; se aplicaron localmente las tres pendientes y se confirmó la cadena de 20. `FR-1042`: cero filas. Ninguna credencial se incluye en esta evidencia.

### Prueba manual en navegador

| Caso | Observación | Resultado |
|---|---|---|
| Credenciales incorrectas | Mensaje “Correo o contraseña incorrectos”; sin acceso al panel | PASS |
| Login actor A | Panel identificado como Synthetic QA A; sin solicitudes V2 iniciales | PASS |
| Formulario sin sedes | Dos campos obligatorios bloquean continuar | PASS |
| Ejemplo V2 | Lima → Arequipa, carga PHARMA, unidades y ventanas explícitas | PASS |
| Crear y evaluar | POST 201, GET 200 y serviceability 200; DRAFT versión 1 | PASS |
| Resultado ROAD | Dos candidatos UNKNOWN, razones de evidencia faltante; no oferta/booking ni geometría inventada | PASS |
| Mis cargas y detalle | Se recupera `77e558a6-22e4-44e9-a259-94c145dbf439`; estado DRAFT, ROAD/FTL, ventana UTC correcta | PASS |
| Reservas | Lectura V2 devuelve estado vacío explícito; crear DRAFT no creó booking | PASS |
| Seguimiento | Lectura V2 devuelve estado vacío explícito, sin telemetría inventada | PASS |
| Login actor B | Su panel no muestra la solicitud A | PASS |
| URL del detalle A bajo B | UI not-found, sin mostrar el snapshot ajeno; no se infiere status HTTP 404 de una respuesta streamed | PASS |
| `/providers` y `/dispatch` | Página 404 | PASS |
| Logout y retorno al dashboard | Retorna a `/login` en la misma autoridad; dashboard redirige al login | PASS |

La creación recorrió Web → API → BD real local. Los datos comerciales del escenario son sintéticos y la falta de capacidad permanece UNKNOWN. Las ventanas del ejemplo son fechas contractuales fijas; no se presentan como disponibilidad actual.

Después del build se inició `next start` y se repitieron manualmente login, dashboard y lectura del mismo detalle persistido. El bundle de producción local conservó el DRAFT, versión y ventana UTC; se tomó evidencia visual del detalle.

### HTTP y gate técnico

- `node cargomesh/scripts/v2-retirement-http-smoke.mjs`, con URL y credenciales QA locales suministradas por entorno: **11/11 PASS**. Incluye login válido/incorrecto, rechazo de origin externo, control positivo `/api/v2/intake/options`, cinco POST V1 con 404, logout 303 y rechazo externo de logout.
- `pnpm --dir cargomesh release:verify`: typecheck, arquitectura, **280/280 pruebas**, production build PASS. El conteo reemplaza la suite mixta anterior: se retiraron pruebas del runtime V1, no se afirma equivalencia por conteos. El perfil SQL V1 permanece separado.
- `python scripts/check-v2-full-model.py`: PASS 57 clases / 397 atributos / 93 relaciones; hash UML original `104b126cc17565b57064fca0c6a8efd5cf43a076c1cb041355e5174cbe68dc88`.
- `python scripts/build-v2-full-der.py --check`: PASS. Sin delta de migraciones, escenarios o servicios de dominio V2 en esta entrega.
- `git diff --check`: PASS.

## Incidencias resueltas y revisión del retiro

El primer login local falló por comparar el origin con la URL normalizada por Next. Se reprodujo, corrigió y repitió el positivo, negativo y cierre de sesión. Las pruebas del helper también rechazan cross-site, autoridad externa y puertos distintos.

La revisión automática rechazó un podado adicional por dependencias por riesgo de eliminar módulos útiles. No se repitió esa operación. Se corrigió el inventario y se restauraron los componentes UI compartidos y las entradas V2 afectadas por la normalización de rutas de Windows. Typecheck/build y la prueba manual verifican los consumidores preservados; el CSV permite revisar explícitamente lo retirado.

## CI y límites

Los tres jobs de CI se verifican sobre el head publicado en el PR, separando application-gate, SQL V1 histórico y SQL V2/HTTP. Esta evidencia local no sustituye su resultado.

La limpieza no cierra HAC-40/HAC-39, F-02, la matriz del modelo completo, identidad/MCP pendiente ni frontend comercial integral. Reservas y seguimiento se probaron como listas vacías: no se certifica aquí una UI completa para confirmar booking o ejecutar operaciones. Tampoco certifica Alexa+ live, carriers live, Supabase alojado ni despliegue. La raíz de Vercel sigue requiriendo una decisión de despliegue separada.
