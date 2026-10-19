# HAC-50 — Asociación de flota persistida con modelos — 18-oct-2026

## Resultado

Checkout: `C:/Users/HP/.codex/worktrees/unified-workspaces/cargomesh`.
Rama existente: `codex/unified-workspaces-demo-boundary`, HEAD `2003eb7d6db385d9588ab30243995eff611dac8a`. Sin commit, push, merge a main ni despliegue.

Se asocia cada vehículo autorizado con un modelo del catálogo de Juan a partir de equipo, carrocería y modelo registrados. La asociación no cambia ID, código, placa, capacidad, estado, sede o conductor. No hay lista fija de Carriers en la lógica.

- Se distinguen rígido, tractocamión cerrado, lona y refrigerado. También existen referencias para las otras seis familias del catálogo.
- Un tractocamión con caja BOX ya no se presenta como rígido cuando el equipo/modelo registrado indica tractor o tráiler.
- Un diseño explícito reconocido se utiliza únicamente si pertenece a la familia compatible. Una referencia desconocida conserva la referencia de familia; un equipo desconocido no recibe una asociación inventada.
- Las tarjetas usan el póster del modelo asociado; ficha e inspección pueden abrir su modelo WebGL. Fotografías propias locales, cuando existen, conservan prioridad.
- Los datos siguen llegando por APIs/RPC nativas con sesión y permisos. No se convierte el JSON del fixture en una respuesta de reemplazo ni se usa service-role para las lecturas del front.

## Dos perfiles del mismo proyecto

- **8080:** front y Supabase habituales, conservados. En Flota hay enlace `Open connected test fleet`.
- **8083:** mismo checkout/código/rutas, con el escenario persistido en un Supabase local aislado: <http://127.0.0.1:8083/carriers/fleet>.

Se eligió un perfil separado para permitir trabajo simultáneo en otras pantallas y preservar los datos/sesión del entorno habitual. `.env.local` mantiene su hash previo. No se importó el seed en Supabase alojado.

La base local `hac50_scenario_fleet80_global_v1` contiene **10 Carriers, 16 Depots, 20 servicios, 80 vehículos y 80 conductores**. Lectura directa del 18-oct: 23 rígidos, 20 articulados, 17 lona y 20 refrigerados. Se recuperó la base existente; no se reseteó ni se regeneró el escenario.

La cuenta representativa preparada conserva sus tres Carriers autorizados: Lima, California y Centroamérica Norte (**22 vehículos y 22 conductores** en total). No se ampliaron membresías para hacer visibles los otros siete. Sus dos servicios separan las flotas; la UI distingue el intervalo de temperatura registrado y no interpreta un intervalo ausente como permiso de carga general.

## Runtime local y autenticación

- Auth existente del escenario: loopback 59731.
- PostgREST dedicado al banco marcado: loopback 59732, imagen local existente.
- Gateway del perfil: loopback 59730, sin almacenamiento de negocio; valida origen/clave y reenvía el JWT al servicio nativo.
- Front del perfil: loopback 8083, salida `.next-fleet-scenario` separada de `.next-dev` y `.next`.
- Cookie propia `sb-cargomesh-fleet80-auth-token`, solo para el perfil exacto de desarrollo y URL local. Evita colisiones con otras sesiones locales.
- Los valores privados están fuera de Git en `%LOCALAPPDATA%/CargoMeshV2Local/fleet-scenario-20261018/`, con permisos del usuario y SYSTEM. No se publican en este documento.
- Cuenta precargada mediante el endpoint local existente: requiere opt-in del servidor, desarrollo, host loopback, puerto autorizado y petición desde el login del mismo origen. Producción y lecturas cruzadas permanecen bloqueadas.

Para retomar, con Docker y la base existente disponibles:

```powershell
# Desde la raíz del checkout: comprueba/recupera los perfiles representativos existentes.
python supabase/scenarios/v2-carrier-fleet-80/prepare-demo-access.py
python supabase/scenarios/v2-carrier-fleet-80/prepare-local-runtime.py

# Desde cargomesh/: no modifica .env.local.
$env:CARGOMESH_SCENARIO_CONFIG = Join-Path $env:LOCALAPPDATA 'CargoMeshV2Local/fleet-scenario-20261018/runtime.private.json'
node --dns-result-order=ipv4first scripts/dev-fleet-scenario.mjs
```

No iniciar otro runtime si 8083/59730 ya están ocupados. Al cierre, el perfil usaba PID **17056** y el front habitual seguía disponible. Si el navegador requiere login, la cuenta sintética está precargada y el botón usa autenticación real. La sesión preparada en el navegador no es una omisión de los guards.

## Evidencia nueva

- **47 tests aprobados, 0 fallidos**, incluyendo los 80 mapeos del escenario, las diez familias, diseños incompatibles/desconocidos, aislamiento de cookies y restricciones del login.
- TypeScript aprobado; arquitectura: **574 módulos / 171 entradas cliente**.
- Build de producción aprobado en `build.log`; no se desplegó.
- API real: login, tres membresías y lectura de assets, drivers, services y depots de cada Carrier. **22 assets / 22 drivers**, sin escrituras comerciales. Sesiones del script cerradas solo con alcance local.
- Navegador: login nativo; Centroamérica con ocho unidades no refrigeradas y dos refrigeradas en su otro servicio; códigos/placas persistidos, póster correcto y tractocamión renderizado en WebGL. Reproducción y pausa comprobadas.
- Móvil 390×844: las dos tarjetas refrigeradas dentro del viewport, sin overflow. Escritorio 1366×900 comprobado.
- 8080 conserva su Carrier HAC44, su sesión y su conexión habitual; tiene enlace al perfil separado.

Archivos de evidencia: `tests-final.tap`, `API_RESULTS.json`, `DATABASE_COUNTS.json`, `build.log`, `connected-model-cards.png`, `associated-truck-webgl.png` y respaldo `before/`.

## Límites que continúan

- La escena de sede con cinco camiones sigue siendo simulación visual. Esta asociación no publica presencia física, cola real de muelles ni tareas de los 80 vehículos.
- Los conductores están registrados; no se inventó un emparejamiento permanente vehículo–conductor.
- La disponibilidad debe evaluarse en una ventana con agenda, mantenimiento y reposicionamiento. El estado AVAILABLE del catálogo no la acredita.
- Las ventanas del escenario conservan su reloj/versionado original y horizonte hasta el 30-oct; no se extendieron para ocultar caducidad.
- La conexión de Cliente, geocoding/Google Maps desde 8083, GPS y flujo comercial completo no se certificaron aquí.
- Cambiar el escenario del Supabase alojado o trasladar esta base al entorno habitual requiere una decisión separada de destino e importación.
