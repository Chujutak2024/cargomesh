# C-01 — Verificación reproducible de seguridad y discovery

Ejecutar desde `frontend/` después de levantar el frontend local y Supabase local.

```powershell
pnpm test:discovery
pnpm typecheck
pnpm build
```

## Endpoint de discovery

Sin parámetro, el endpoint rechaza la petición con `400`:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/orchestration/candidates -SkipHttpErrorCheck
```

Sin sesión, una `FreightRequest` explícita devuelve `401`:

```powershell
Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/orchestration/candidates?request=FR-1042' -SkipHttpErrorCheck
```

Con una sesión Supabase válida de un usuario sin membresía `ACTIVE`, la misma llamada devuelve `403`. Con una sesión de un miembro de otra organización devuelve `404`; con el miembro de la organización dueña devuelve `200`.

Estas dos últimas comprobaciones se hacen desde el navegador autenticado, porque el cliente SSR valida la cookie Supabase con `auth.getUser()` y no acepta claims inyectados por el navegador.

## RLS local sin navegador

El siguiente bloque verifica el aislamiento de base de datos usando los fixtures locales. No modifica datos: cada bloque termina con `ROLLBACK`.

```powershell
docker exec supabase_db_cargomesh psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'begin; set local role anon; set local "request.jwt.claims" = ''{"role":"anon"}''; select count(*) from public.freight_requests; rollback;'

docker exec supabase_db_cargomesh psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c 'begin; set local role authenticated; set local "request.jwt.claims" = ''{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}''; select code from public.freight_requests order by code; rollback;'

docker exec supabase_db_cargomesh psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c 'begin; set local role authenticated; set local "request.jwt.claims" = ''{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}''; select count(*) from public.freight_requests; rollback;'
```

Resultados esperados: anónimo denegado, miembro ACME ve `FR-1042`, usuario sin membresía ve `0` filas. Para el escenario «miembro de otra organización», crear una segunda organización y membresía de fixture dentro de una transacción local, ejecutar la consulta con su `sub` y hacer rollback.

## Revisión de secretos

```powershell
rg -n "SUPABASE_SERVICE_ROLE_KEY|service_role" frontend/src
rg -n "SUPABASE_SERVICE_ROLE_KEY|service_role" frontend/.next/static
```

Las referencias de `service_role` solo son aceptables en módulos `server-only`, como `src/lib/supabase/admin.ts`; `frontend/.next/static` debe devolver cero coincidencias. El módulo discovery no importa `createAdminClient`.

## Handoff para A — INT-01

Discovery conserva `matchingServiceId` y entrega la URL mediante:

```ts
buildProviderNavigationUrl(candidate, "https://cargomesh.example")
// https://cargomesh.example/providers/andes?serviceId=<matchingServiceId>
```

Durante `INT-01`, A debe hacer un cambio aditivo en sus archivos propios:

1. Leer `searchParams.serviceId` en `/providers/[carrierSlug]`.
2. Pasarlo a `getProviderPageConfig(carrierSlug, serviceId)`.
3. Consultar exactamente `carrier_services.id = serviceId`, además de `carrier_id`, `active = true` y `provider_service_code` no nulo.
4. Si falta, no pertenece al carrier o está inactivo, responder `notFound()`; nunca usar `limit(1)` como fallback.

No cambia `CandidateProvider` ni `ProviderPageConfig`.

## Región y URL de providers

`freight_requests` no tiene columnas de región; C-01 usa `origin_city` y `destination_city` como la granularidad regional actual. Un `origin_region` o `destination_region` nulo en `carrier_services` es wildcard; uno definido debe coincidir.

El discovery acepta dos formas seguras de `provider_url`:

- rutas internas de CargoMesh bajo `/providers/<carrier-slug>`;
- URLs externas absolutas HTTP(S).

Rechaza valores vacíos, `//host`, `javascript:`, `data:` y rutas relativas fuera de `/providers/`. La navegación interna requiere un `baseUrl` explícito, por lo que los fixtures oficiales `/providers/andes`, `/providers/inca` y `/providers/pacific` funcionan tanto en local como en despliegues sin guardar un dominio en Supabase.
