# Transición Cliente ↔ Carrier para la demo — 21 octubre 2026

## Refinamiento posterior solicitado por el usuario

La UI descrita en el corte inicial de abajo queda ajustada: se eliminó el
selector lateral `Demo · Cliente / Carrier` de ambos portales y la introducción
`Two perspectives. One connected journey.`. Los enlaces directos abren el
espacio solicitado automáticamente para las cuentas de demo autorizadas; durante
la verificación solo aparece `Abriendo Cliente/Carrier…`.

Los avisos restantes usan textos breves (`Sesión actualizada`, `Continúa en
Cliente/Carrier`, `Reintentar`, `Recargar`). Se mantienen las comprobaciones de
sesión, la barrera entre pestañas, la recuperación de error y la confirmación del
borrador sin guardar. Para una cuenta ajena sigue siendo necesario confirmar el
uso de la cuenta demo; no se la sustituye silenciosamente.

Revalidación: `test:workspace-demo` 34/34, smoke HTTP 37 checks (ahora también
comprueba ausencia de introducción y selector), typecheck y arquitectura PASS.
Las capturas del corte inicial con el selector son históricas, no la UI vigente.
Navegador revalidado: entrada directa Cliente → Carrier → Cliente, sin selector
ni introducción. El aviso breve entre pestañas se verificó a 390 px (diálogo de
354 px, sin overflow). Evidencia nueva fuera de Git en el subdirectorio
`artifacts/workspace-switch-2026-10-21/simplified/` del workspace Codex.

## Alcance y estado

Trabajo local solicitado sobre `main`, HEAD base `b96a3b7`. Sin commit, push,
merge, cambio de Linear, despliegue ni configuración remota. No se agregaron
dependencias, cuentas, membresías, migraciones, seeds ni permisos.

## Fricción y causa

La sesión Carrier y la membresía Cliente son autoridades distintas. Abrir un
enlace Cliente con la sesión Carrier podía terminar en `No Client access`.
La entrada asignada también presentaba una pantalla de texto sin recuperación.
El fallback visual de demo existente no equivale a una cuenta Cliente conectada.
Eliminar la comprobación de membresía habría ocultado la causa y roto el límite
entre organizaciones; no se hizo.

## Cambio implementado

- Selector `Demo · Cliente / Carrier` en las dos barras laterales, incluido menú
  móvil y rail compacto. Inicio nativo con las identidades sintéticas ya
  configuradas, sin escribir credenciales y con navegación de documento completo.
- Entrada y recuperación visual coherente con los portales. Enlaces directos al
  workspace conservan ruta, query y fragmento tras la entrada automática.
- Entrada automática solo para visitantes anónimos o la identidad sintética
  configurada exacta. Una cuenta ajena, real o sin email requiere elegir la demo
  explícitamente. `connected=1` conserva el acceso normal con cuenta propia.
- `POST /api/auth/workspace-session` solo admite `{workspace:"client"|"carrier"}`.
  Comprueba origen/host exactos y CSRF; no admite credenciales, tenant, rol ni
  destino arbitrarios enviados por el navegador. Las respuestas no llevan claves.
- Cookies preparadas en memoria y confirmadas únicamente después de comprobar
  identidad, email confirmado y acceso nativo. Cliente exige la organización
  efectiva usada por el portal, activa, sintética y con rol SUPERVISOR. Carrier
  exige su lista nativa de accesos sintéticos. Un fallo no concede permisos ni
  activa un fallback visual como si fuera éxito conectado.
- Durante el cambio, la vista anterior queda inerte. Error/timeout ofrece
  reintento o recarga verificable, sin habilitar acciones con identidad incierta.
- Borrador nuevo o editado: modal accesible Cancelar/Continuar antes de cambiar;
  cancelar o Escape conserva datos y foco. No guarda ni crea automáticamente.
  Durante crear/revisar/leer/evaluar, el cambio queda bloqueado.
- Otras pestañas reciben solo metadatos, nunca tokens. La vista antigua permanece
  montada pero inerte hasta continuar con la sesión actual; también se protege su
  borrador. No se inicia un intercambio automático de cuentas entre pestañas.
- Logout de demo usa scope local, sin cerrar globalmente otras sesiones.

## Activación local aplicada

Único origen de esta comprobación: `http://127.0.0.1:8080`.

En el `.env.local` ignorado se habilitó `CM_ENABLE_DEMO=1`,
`CARGOMESH_LOCAL_WORKSPACE_DEMO_ENABLED=true`, el origen exacto y la organización
sintética existente. Las dos credenciales se leen de un archivo privado existente
fuera de Git, con dos pares `Email:`/`Password:` (Cliente primero, Carrier después).
No se copian al bundle, a esta evidencia ni a las respuestas HTTP.

Este modo exige desarrollo no-productivo y Supabase HTTP loopback. No funciona
con una base alojada, un puerto/origen distinto ni un build de producción.
Se puede usar alternativamente configuración privada server-only explícita:
`CARGOMESH_DEMO_CLIENT_EMAIL`, `CARGOMESH_DEMO_CLIENT_PASSWORD`,
`CARGOMESH_DEMO_CLIENT_ORGANIZATION_ID`, `CARGOMESH_DEMO_CARRIER_EMAIL` y
`CARGOMESH_DEMO_CARRIER_PASSWORD`. Véase `.env.example` sin valores secretos.

## Verificación real

| Comprobación | Resultado |
| --- | --- |
| `pnpm test:workspace-demo` | 34/34 PASS |
| `pnpm test:workspace-demo:http` | 37 checks PASS, cookies reales y APIs V2 nativas |
| `pnpm test:release` | 479/479 PASS, 18 suites; 9 recetas LOCAL_ONLY verificadas sin activarlas |
| `pnpm test:auth` | 10/10 PASS |
| `pnpm test:carrier-entry` | 40/40 PASS |
| `pnpm test:carrier-navigation` | 7/7 PASS |
| `pnpm test:workspace-modes` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm check:architecture` | PASS, 666 módulos / 198 entradas cliente |
| `pnpm build` | exit 0 |

El smoke HTTP no usa claves privilegiadas ni headers de fixtures: cambia
Cliente → Carrier → Cliente, lee oportunidades nativas, comprueba 403 cruzados,
rechaza CSRF y payloads arbitrarios, valida logout/reentrada y compara solicitudes,
bookings y ejecuciones antes/después. No envía comandos comerciales.

Navegador: cambio en ambos sentidos, acceso a Comercial con 21 oportunidades
locales, enlace directo al intake, modal Cancelar/Continuar/Escape, foco circular,
conservación del origen elegido al cancelar, y dos pestañas con borrador abierto.
Al cancelar la recuperación tras un cambio externo, se conserva el borrador pero
la vista sigue bloqueada: no puede escribir con la identidad nueva inadvertidamente.
Móvil 390 px: ambos menús y cambio operativo; botones de 44 px de alto, sin
overflow horizontal. Tablet 768 px y escritorio 1280/1366 px comprobados.

Capturas locales, fuera de Git:
`C:/Users/holap/Documents/Codex/artifacts/workspace-switch-2026-10-21/`:
`client-desktop.jpg`, `carrier-desktop.jpg`, `client-mobile-390.jpg`,
`carrier-mobile-390.jpg`, `client-tablet-768.jpg`, `unsaved-confirmation.jpg` y
`cross-tab-guard.jpg`.

Los casos de infraestructura caída, permisos inválidos, identidad ajena y
operación en curso están cubiertos con pruebas focalizadas; no se detuvo Docker
ni se modificaron cuentas reales para fingir esos fallos en la prueba visual.

## Pendiente fuera de este alcance

No se ha publicado este código. Para probarlo alojado se necesita su revisión y
publicación autorizada, las flags HTTPS de demo asignada existentes y credenciales
de demo sintéticas válidas para ese backend. La política HTTPS previa no se relajó.
Si no se configura Cliente nativo, el modo visual/read-only histórico permanece
explícito; no se presenta como integración persistida. Un fallo nativo no cambia
silenciosamente a ese modo visual.

Se mantienen separados autenticación, borrador conversacional, selección de
oferta y consentimiento comercial. Cambiar workspace no confirma ofertas,
bookings, capacidad ni eventos de seguimiento. Google Maps, voz y operaciones
comerciales no se reconfiguraron con este cambio.
