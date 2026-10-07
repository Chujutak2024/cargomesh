# CargoMesh V2

CargoMesh captura solicitudes y expone operaciones persistentes de transporte mediante una aplicación Next.js, API Hono y servidor MCP.

## Entradas

- [Contratos y alcance V2](docs/v2-amazon/README.md).
- [Endpoints implementados](docs/v2-amazon/delivery/HAC40_API_ENDPOINTS.md).
- [Backend](cargomesh/src/server/README.md).
- [Flujo de entrega](docs/v2-amazon/delivery/CURRENT_DELIVERY_STATE.md).

## Desarrollo local

La aplicación está en `cargomesh/`. Usa la versión de pnpm declarada por el gate y Node 24.

```sh
pnpm --dir cargomesh install --frozen-lockfile
pnpm --dir cargomesh dev
```

Copia `cargomesh/.env.example` a `cargomesh/.env.local` y configura el Supabase V2 correcto. Para QA local sigue [el bootstrap V2](docs/v2-amazon/delivery/HAC29_CLEAN_BOOTSTRAP.md). Los escenarios sintéticos se cargan explícitamente, fuera de migraciones.

El acceso usa correo/contraseña y exige membresía activa. No hay login automático de demo ni directorio WebMCP de tres carriers. El flujo visible implementado incluye captura/evaluación ROAD, listado/detalle de solicitudes y lectura de reservas/ejecuciones V2; no acredita pantallas completas de oferta, ranking o booking.

## Verificación

```sh
pnpm --dir cargomesh release:verify
```

Los gates SQL separan la cadena nativa `supabase-v2/` de la cadena histórica `supabase/`. La cadena histórica es entrada de regresión/importación; no se conecta al producto V2 ni se carga automáticamente como catálogo.

## Historial y límites

La entrega WebMCP anterior y sus documentos se consultan en el [corte previo a la limpieza](https://github.com/Chujutak2024/cargomesh/tree/feef2419fa5f786c9a6063f85aeee452dd9eb84b). No describen capacidades actuales de V2.

El servidor MCP ofrece únicamente sus herramientas V2 implementadas y declara los límites pendientes. Una demo local o un esquema modelado no prueban Alexa+ live, carriers operativos ni despliegue alojado. La configuración de Vercel debe corresponder a `cargomesh/` antes de aceptar un despliegue V2.
