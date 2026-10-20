# Acceso cruzado de demo y mapa — 20 octubre 2026

## Reproducción en Production

- Dominio: https://cargomesh.vercel.app.
- Carrier abre mediante el acceso automático existente; cuenta Carrier sintética.
- Navegar después a `/clients` muestra `No Client access`, porque `useClientPreview` no admite el fallback visual ante una sesión autenticada sin membresía Cliente.
- En `/carriers/control-tower` el mapa muestra `Google Maps is not configured`.
- Consulta de metadatos por Vercel CLI API, proyecto cargomesh/ANJUJE: cero entradas `NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY`. No se imprimen ni guardan valores de otras variables. Root Directory confirmado `cargomesh`.
- Capturas: `client-after-carrier-production.png`, `map-production.png`. Diagnóstico vía IAB, sin micrófono ni transacciones comerciales.

## Corrección preparada en el checkout activo

- Rama existente `codex/unified-workspaces-demo-boundary`, base local `84b6a8b`.
- `client-preview-selection`: admite callback explícito para el fallback visual de la cuenta Carrier demo ante FORBIDDEN; por defecto sigue denegando.
- `assigned-demo-policy`: verifica dominio HTTPS habilitado, identidad exacta de la cuenta sintética configurada y acceso Carrier sintético vigente.
- `local-client-preview`: revalida identidad y acceso nativos antes del fallback.
- Dos archivos de pruebas cubren cuenta equivocada/real, dominio ajeno, demo desactivada, acceso ausente, prioridad del Cliente nativo y propagación de errores de infraestructura.
- No altera RLS, membresías, login normal, oferta/reserva ni autorización de escritura. Cliente demo continúa siendo visual/read-only hasta su activación nativa separada.

## Comprobaciones ejecutadas

`node --conditions=react-server --import tsx --test src/server/auth/client-preview-selection.test.ts src/server/auth/assigned-demo-policy.test.ts`: **13/13 PASS**.

`node node_modules/typescript/bin/tsc --noEmit --incremental false`: **exit 0**.

No suite general, nuevas migraciones, seeds, cuentas o prueba end-to-end del arreglo desplegado. Cambios ajenos AGENTS.md/next-env/cache preservados.

## Publicación pendiente

Solicitada autorización específica para llevar este hotfix nuevo a main y configurar la variable Maps en Production con la clave existente local. El AGENTS aportado por el usuario congela main; no se presume que la autorización del corte anterior incluya este nuevo cambio.

Una vez autorizado: publicar por PR/gates; añadir la variable privada del proyecto sin exponer su valor; nuevo build; comprobar Carrier→Cliente→Carrier y mapa. La restricción HTTP referrer/API/billing del proveedor, si aparece tras cargar la clave, se diagnostica separadamente; no hay evidencia todavía de ese fallo.

No despliegue ni cambio de Vercel aplicado durante la preparación. El mapa no se arregla por volver a desplegar el mismo build sin la variable.
