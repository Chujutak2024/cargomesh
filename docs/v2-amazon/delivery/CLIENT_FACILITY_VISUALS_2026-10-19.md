# Cinco instalaciones adicionales y preparación visual para Cliente

Entrega visual de Juan, 19-oct-2026. **15 arquitecturas / 23 diseños de camión**. Referencias ilustrativas; no son instalaciones creadas ni operaciones persistidas.

## Base y destino de integración

- Rama solicitada y conservada: `codex/v2-full-carrier-operations`.
- Base coordinada: `origin/codex/unified-workspaces-demo-boundary` @ `90d7d9af095fc67ba913c2cc7d609a394eb07c9a`, incorporada sin conflictos en `b6a36b288aa3d69cfe60f418468c268c304f0a9c`.
- Antecedente necesario: `8207dbc` ya publicado, que añadió las sedes 6–10 y la retención de cámara. El diff completo frente a la base puede incluir también ese incremento todavía no integrado; no aplicar este corte aislado omitiendo su dependencia.
- Destino propuesto para este corte 3D: `codex/unified-workspaces-demo-boundary`, según su registro específico. Consultado al usuario porque HAC-53 registra otra rama de intake Cliente y target `main`; **no se mezcla ese encargo ni se reabre HAC-43 Done**. No se crea PR ni se ejecuta merge mientras se coordina el destino.
- Se publica únicamente en la rama feature solicitada. Sin merge a main, configuración de Vercel/ECS, migraciones aplicadas o escrituras Supabase.

## Arquitecturas nuevas

| ID compartido | Estructuras propias |
|---|---|
| `industrial-plant` | Nave de producción con máquinas, cubierta a dos aguas y chimeneas; almacén separado y pórtico de carga. |
| `agricultural-hub` | Cobertizos abiertos con cajas de producto ilustrativas, tolvas de recepción, báscula y línea de clasificación. |
| `retail-store` | Supermercado acristalado con pasillos/cajas y acceso público en una cara; almacén de recepción y muelles en la cara opuesta, detrás de la sala de venta. |
| `pharmaceutical-centre` | Recepción controlada con abrigos, salas de almacenamiento separadas, corredor acristalado y tratamiento de aire en cubierta. |
| `fulfilment-centre` | Pasillos de picking, estaciones de preparación elevadas, transportadores de clasificación y muelles de despacho. |

Los diez diseños anteriores conservan su geometría exacta mediante hashes SHA-256. Las 15 geometrías difieren también con materiales monocromos, tienen volumen finito y permanecen bajo los límites de lotes/triángulos. No se agregan camiones, dependencias ni modelos descargados.

El catálogo y el renderer son únicos. Los contadores/selector existentes derivan del catálogo, por lo que Flota y el estudio muestran 15 sin otra lista paralela. Toda arquitectura puede ser una referencia de Carrier o Cliente: no contiene propietario ni elegibilidad de servicio.

## Preparación para Cliente

### Datos separados

1. **Identidad y propiedad:** `FacilityV2.id` y `FacilityV2.organizationId`, recibidos de la lectura autorizada existente.
2. **Función registrada:** `FacilityV2.value.facilityType`; no se cambia por elegir una arquitectura.
3. **Uso en un envío:** ubicación canónica con `facilityId` y rol `PICKUP`/`DELIVERY`. La inspección desde el directorio usa rol nulo, sin inventar un envío.
4. **Apariencia explícita:** `FacilityVisualBinding = { organizationId, facilityId, templateId }`, fuera de `FacilityInputV2` y de sus comandos de escritura.

`resolveFacilityVisual` reutiliza los schemas de Facility y ubicación. Exige una instalación autorizada y una referencia visual únicas que coincidan en organización/ID. Ausencia, duplicados, propietario ajeno, schema inválido o diseño desconocido producen **sin referencia**, sin inferir desde nombre, país, tipo, cercanía o actividad. Conserva la ubicación/pin original; no genera coordenadas.

`FacilityReference` reutiliza `DepotArrival` y el renderer de sedes en modo de referencia: sin camiones, tareas, reservas, eventos o controles de reproducción. Conserva órbita, zoom, interior, carga/error/reintento y texto HTML. Los muebles/cajas de la geometría son ilustrativos y no se presentan como inventario.

`FacilityEndpointVisuals` representa recogida/entrega con su referencia correspondiente. El estado se crea por encima de las vistas: clave por **uso + organización + instalación + diseño**, incluso si ambos extremos usan la misma instalación. Retiene cámaras/interior independientes y selección de extremo al desmontar el visor. No publica React por cada frame.

`FacilityDirectory` conserva búsqueda, filtros y fichas; acepta opcionalmente `visualReferences`. Solo muestra el botón 3D cuando existe una asociación explícita válida. Sin esa prop, su comportamiento anterior permanece.

### Integración preparada, sin activación alojada

Ejemplo en un componente cliente que ya recibió datos autorizados:

```tsx
const [visualState] = useState(createFacilityEndpointState);
<FacilityEndpointVisuals
  organizationId={activeOrganizationId}
  facilities={authorizedFacilities}
  origin={request.origin}
  destination={request.destination}
  references={explicitVisualBindings}
  state={visualState}
/>
```

Importar componentes de `features/logistics-3d/facility-reference` y estado/adaptador de `facility-visual`. Mantener ese estado en el propietario de las vistas, no crearlo de nuevo al seleccionar una pestaña. `FacilityDirectory` recibe las mismas referencias mediante su prop opcional. No serializar el Map del estado a través de un Server Component: se crea en el componente cliente.

**Qué falta exactamente para Cliente conectado:**

- Proporcionar la lectura autorizada de Facilities de la organización activa y los `facilityId` de origen/destino del pedido real. El adaptador no consulta otros tenants ni carga datos por su cuenta.
- Acordar con el dueño de Facilities el origen/persistencia y lectura autorizada de `FacilityVisualBinding`; el contrato canónico actual no tiene un campo de apariencia. No se añadieron columnas, endpoints o escrituras para suplirlo.
- En este entorno siguen faltando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del V2 acordado. No se recibió ruta de archivo privado, no se usa otro proyecto y no se necesitan claves administrativas para esta entrega.
- Tras aportar lo anterior, el consumidor de Cliente debe pasar referencias reales y comprobar la sesión/tenant con el backend existente. El estudio no acredita ese recorrido conectado.

El tab **Facility endpoints** es una demostración local rotulada, usando dos contratos de prueba sin dirección geográfica; no crea registros ni consulta APIs empresariales. No reemplaza el formulario de HAC-53 ni las pantallas de Jean/Luis.

## Corrección de asociación de camiones

- `truckBody` y `compatibleTruckDesign` son la política compartida de carrocería/familia. Un hint por sí solo no autoriza cambiar de carrocería.
- `associateAssetVisual` usa los campos explícitos `equipmentType` y `roadVehicle.bodyType`. `modelName` se conserva en la interfaz por compatibilidad, pero ya no determina el modelo visual.
- Portavehículos/ganadero requieren carrocería explícita compatible con tractor/remolque; grúa con plataforma; recolector con rígido; silo con cisterna. Los cinco se resuelven sin necesitar un hint. Otros cruces o carrocerías desconocidas quedan sin modelo específico.
- Hints inválidos con cuerpo/chasis conocidos vuelven a una referencia compatible: BOX rígido no acepta recolector; BOX articulado no acepta ganadero/portavehículos; plataforma no acepta grúa salvo que se registre esa carrocería.
- El coordinador del patio valida también el cuerpo, aunque el camión no lleve pallets. El selector solo ofrece diseños compatibles. Los 23 siguen disponibles para inspección libre en el catálogo.
- Un especialista sin poster propio usa una ilustración neutral y su modelo 3D correcto; datos de servicio sin asociación usan “sin modelo específico”. Las fotos propias conservan prioridad.
- No se derivan ni modifican capacidad, peso, dimensiones, permisos, actividad o disponibilidad desde apariencia.

La regresión de 80 filas detecta **17 registros** con `body_type=BOX` y nombre comercial `Curtainsider`. Ahora se respeta BOX con referencia genérica rígida; no se corrigen registros ni manifiestos del escenario. El dueño de datos puede revisar la carrocería con el flujo autorizado si esos vehículos realmente son de lona.

## Verificación y preview

Desde `cargomesh/`, con dependencias existentes:

```powershell
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:logistics'],{stdio:'inherit'})"
node -e "require('node:child_process').execSync(require('./package.json').scripts['test:connected-fleet'],{stdio:'inherit'})"
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-architecture.mjs
node node_modules/next/dist/bin/next build
```

- Logística **152/152 PASS**: hashes de 10 sedes, 15 geometrías, encuadre, recepción comercial posterior, liberación de materiales/geometría/textura exactamente una vez, 23 diseños compatibles/negativos, datos inmutables, ámbitos de Facilities y estado de ambos extremos en una misma sede.
- Flota conectada **45/45 PASS**. TypeScript PASS; arquitectura PASS (600 módulos / 179 entradas cliente).
- Build inicial y confirmación final tras correcciones: **PASS**, incluidas compilación, tipos y generación de páginas.
- Primera inspección y confirmación final: **18 comprobaciones de navegador PASS**, con vistas adicionales del frente público e interior comercial. Las **7 comprobaciones de continuidad legacy** también pasan; las correcciones finales afectan la topología comercial y la identidad de estado Cliente.
- Detector visual ejecutado una vez: `[]`. Revisión encontró recepción comercial frontal y estado compartido en el caso de misma sede; corregidos con pruebas específicas y confirmación acotada.
- Verdict pass independiente: **ship**, ambos hallazgos resueltos. Ese veredicto se limita a las dos correcciones; no certifica una conexión Cliente alojada ni autoriza merge.

Para reproducir navegador, arrancar Next dev en 8091 y usar una instalación existente de Playwright/Chromium:

```powershell
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 8091
# En otra terminal:
$env:CARGOMESH_PLAYWRIGHT_MODULE = '<ruta absoluta a playwright/index.mjs>'
$env:CARGOMESH_CHROMIUM_EXECUTABLE = '<ruta absoluta a chrome.exe>'
$env:CARGOMESH_PREVIEW_URL = 'http://127.0.0.1:8091'
$env:CARGOMESH_EVIDENCE_DIR = '<carpeta local para evidencia>'
node scripts/verify-facility-designs.mjs
node scripts/verify-depot-preview.mjs
```

[Abrir estudio](http://127.0.0.1:8091/vehicle-designs) → **Depot designs** (15 arquitecturas) o **Facility endpoints** (recogida/entrega). El runtime 8080 es independiente y no fue sustituido.

Navegador Chromium156 / ANGLE RTX2060, DPR1; escritorio1440×1100 y móvil emulado390×844. Geometría completa, órbita/zoom/teclado e interior. El test bloquea y registra peticiones API/externas; no se acepta sustitución por datos de servicio. Dos ciclos completos de las 15 sedes vuelven a205 geometrías/9 texturas en industrial-plant; no es medición de VRAM ni promesa de FPS. La hora se fija al mediodía solo en el contexto de captura para legibilidad.

## Archivos y evidencia

Todos los paths de código siguientes son relativos a `cargomesh/`:

- `src/features/logistics-3d/depot-{templates,model}.ts`: cinco arquitecturas nuevas; diez anteriores intactas.
- `src/features/logistics-3d/{visual-catalog,asset-visual,depot-coordinator}.ts`: compatibilidad conjunta y validación del guion.
- `src/features/logistics-3d/facility-visual.ts` (nuevo): asociación canónica explícita, estado y controladores por extremo.
- `src/features/logistics-3d/facility-reference.tsx` y `facility-reference-preview.tsx` (nuevos): visor compartido y demostración local.
- `src/features/logistics-3d/{depot-arrival,depot-preview,depot-yard-scene}.tsx` y sus dos CSS existentes: modo de referencia, tab y estado del estudio; controles/fallback conservados.
- `src/features/shipper-portal/facility-directory.tsx`: **solapamiento Cliente**, solo integración opcional de referencia; no cambia contratos ni lecturas/escrituras existentes.
- `src/features/{carrier-portal,carrier-juan}/fleet-photos.ts`: fallback neutral sin falsa carrocería.
- `public/v2-workspace/trucks/reference.svg` (nuevo): placeholder geométrico neutral, no un camión adicional.
- `src/features/logistics-3d/{asset-visual,depot-model,visual-catalog}.test.ts` y `facility-visual.test.ts` (nuevo): regresiones/compatibilidad/ámbitos/estado.
- `scripts/verify-facility-designs.mjs` (nuevo): navegador reproducible, desktop/móvil, casos Cliente, memoria, fallback y estado. `package.json` agrega las pruebas de asociación e instalaciones a `test:logistics`, sin cambiar dependencias.
- Este informe y la evidencia saneada siguiente.

[Cinco instalaciones](evidence/CLIENT-facility-visuals-2026-10-19/five-client-facilities.png) · [Cliente escritorio](evidence/CLIENT-facility-visuals-2026-10-19/facility-endpoints-1440.png) · [Cliente móvil](evidence/CLIENT-facility-visuals-2026-10-19/facility-endpoints-390.png) · [Frente público comercial](evidence/CLIENT-facility-visuals-2026-10-19/retail-public-front.png) · [Interior comercial](evidence/CLIENT-facility-visuals-2026-10-19/retail-interior.png) · [Checks y recursos](evidence/CLIENT-facility-visuals-2026-10-19/browser-results.json) · [Estado legacy](evidence/CLIENT-facility-visuals-2026-10-19/retained-state.json).

## Límites

Sin certificación Supabase, autorización de tenants reales, disponibilidad, inventario o ejecución conectada. Sin móvil físico ni benchmark FPS/VRAM. No se modifican los contratos canónicos de Facilities/flota, autenticación, rutas o datos empresariales. Sin cambios propios en Vercel, ECS, credenciales, esquema o datos Supabase. La base del equipo se descargó para coordinar código; sus SQL no se aplicaron por este encargo.
