# CargoMesh — Borrador de handoff REL-02

> **Estado:** BORRADOR. REL-02 no está completado.
>
> **Estado de dependencias:** Día 3 / INT-03 está cerrado. Permanecen pendientes REL-01, la URL pública, el video, las capturas y la validación externa.
>
> **Uso:** base editorial para Devpost, video y ensayo conjunto. No contiene credenciales ni valores de variables de entorno.

## 1. Historia del proyecto

### El problema

Coordinar carga internacional sigue siendo un proceso fragmentado. Una empresa describe una necesidad logística, pero después debe buscar transportistas, confirmar cobertura, comparar capacidad, pedir cotizaciones, ponderar confiabilidad y gestionar una reserva en sistemas distintos. La información comercial y la evidencia técnica quedan separadas, por lo que una recomendación puede ser difícil de explicar o repetir.

### La propuesta

CargoMesh convierte la intención logística de una empresa en una operación B2B auditable. El usuario describe qué debe transportar, desde dónde, hacia dónde y bajo qué restricciones. A partir de esa solicitud, CargoMesh descubre transportistas compatibles en un registro dinámico `0..N`, visita sus páginas, consulta capacidades estructuradas, persiste las respuestas, aplica un ranking reproducible y presenta alternativas para selección humana. Después solicita el booking al provider, observa su confirmación y, si existe un rechazo, conserva el historial y ofrece una recuperación autorizada.

Los nombres Andes, Inca y Pacific pertenecen únicamente al dataset reproducible de la demo. No son una lista cerrada ni reglas del producto. Un carrier registrado con servicio compatible y un `providerUrl` WebMCP puede entrar al mismo flujo sin agregar una rama comercial por proveedor.

### Por qué WebMCP es central

WebMCP es la frontera que convierte una página logística en una superficie de capacidades estructuradas para un agente. En lugar de extraer texto visual o llamar implementaciones internas, el agente navega el documento del carrier y descubre las tools registradas en `document.modelContext`.

En CargoMesh, WebMCP permite:

1. descubrir qué puede hacer el documento provider actual;
2. validar cobertura y capacidad mediante contratos estructurados;
3. obtener una cotización correlacionada con el carrier y servicio exactos;
4. solicitar `book_freight` después de una selección autorizada;
5. consultar `get_provider_booking_status` para confirmar, rechazar o continuar el booking;
6. demostrar cleanup al abandonar cada documento, evitando tools sobrevivientes del provider anterior.

WebMCP no reemplaza el motor de decisión ni la persistencia. El agente obtiene evidencia desde las páginas provider; el Result Bridge valida y persiste; el motor BALANCED ordena las ofertas; y la persona autorizada conserva la decisión comercial en modo `ASSISTED`. Esta separación reduce alucinaciones y hace visible la causalidad de la demo.

### Declaración de transparencia para Devpost

Los datos base y las respuestas de los carriers de demostración son fixtures deterministas. La navegación WebMCP, el descubrimiento y ejecución de tools, la transferencia estructurada, la persistencia de ofertas, el ranking, la selección humana, el booking, el acknowledgement del provider y la recuperación se ejecutan realmente.

## 2. Guion de demo — duración objetivo 2:45

> Ensayar con cronómetro. Reservar 15 segundos de margen frente al límite de tres minutos.

| Tiempo | Imagen | Narración / acción |
|---|---|---|
| 0:00–0:15 | Login y entrada a CargoMesh | “Mover carga internacional obliga a comparar cobertura, capacidad, precio y confiabilidad entre sistemas aislados. CargoMesh transforma esa intención en una operación auditable.” |
| 0:15–0:35 | Dashboard e intake de FR-1042 | Mostrar la organización autenticada, abrir la solicitud y resumir Callao/Lima → Santiago, ROAD FTL, 8,000 kg, ventana persistida y estrategia BALANCED. |
| 0:35–1:05 | Inicio de orchestration y actividad provider | “CargoMesh descubre `0..N` carriers registrados. El agente navega cada página provider y ejecuta WebMCP real: cobertura, capacidad y cotización. Cada documento expone solo sus propias tools y se limpia al salir.” Mostrar actividad sin detenerse en JSON completo. |
| 1:05–1:30 | Ranking OPTIONS_READY | Mostrar las ofertas variables y el ranking reproducible 89/84/72 con confianza 88. Aclarar que los tres carriers son fixtures del Golden Flow, no un límite. |
| 1:30–1:55 | Selección y booking | Seleccionar una oferta de forma humana. Mostrar `book_freight`, el mismo carrier/servicio y el paso a `PENDING_PROVIDER_CONFIRMATION`; luego mostrar confirmación del provider. |
| 1:55–2:25 | Rechazo y recovery | Usar la evidencia preparada del caso `REJECTED`. Mostrar que CargoMesh conserva el booking rechazado, ofrece únicamente `recoveryOfferIds` autorizadas y crea un reemplazo trazable sin borrar el intento original. |
| 2:25–2:40 | Judge Drawer | Abrir las pestañas de navegación, tools, persistencia, decisión y eventos. Señalar timestamps, cleanup, envelopes y deduplicación. |
| 2:40–2:45 | Cierre | “CargoMesh demuestra cómo WebMCP permite que un agente convierta intención logística en una operación ejecutable, explicable y recuperable.” |

### Reglas de grabación

- Capturar en un navegador WebMCP compatible y ocultar barras, notificaciones o datos ajenos al proyecto.
- No mostrar archivos `.env`, secretos, tokens, cookies, consola con credenciales ni paneles administrativos.
- Mantener el cursor quieto durante la narración y ampliar únicamente la evidencia necesaria.
- Si una navegación real tarda, usar cortes de edición sin sustituir la ejecución real por fixtures de UI.
- Incluir subtítulos y una etiqueta breve cuando se muestre un fixture determinista.

## 3. Capturas necesarias

| ID | Captura | Evidencia mínima visible | Responsable |
|---|---|---|---|
| CAP-01 | Login | Marca CargoMesh, acceso demo y ausencia de errores visuales | B |
| CAP-02 | Intake | Ruta, carga, modo, peso total, ventana persistida, deadline y estrategia | B |
| CAP-03 | Ranking | Estado `OPTIONS_READY`, colección variable de ofertas, scores 89/84/72 y confianza 88 | B + C |
| CAP-04 | Booking | Selección `ASSISTED`, carrier elegido y `PENDING_PROVIDER_CONFIRMATION` o `CONFIRMED` | B + A |
| CAP-05 | Recovery | Booking `REJECTED`, alternativas autorizadas y vínculo con el intento reemplazado | B + C |
| CAP-06 | Judge Drawer — navegación | Provider URL sanitizada, carrier/servicio exactos, entrada, salida y cleanup | A + B |
| CAP-07 | Judge Drawer — tools | Tool, timestamp, input/output sanitizado y superficie `document.modelContext` | A + B |
| CAP-08 | Judge Drawer — persistencia/decisión | Resultado del Bridge, ranking/selección y eventos persistidos | B + C |
| CAP-09 | Responsive | Una composición móvil de intake/ranking y otra de booking/recovery sin scroll horizontal | B |
| CAP-10 | Replay | `idempotentReplay:true`, `DEDUPLICATED`, mismo `bookingId` y conteos sin duplicados | A + C |

Convención propuesta: `rel02-cap-XX-descripcion.png`. Mantener resolución uniforme y no incluir identificadores que no sean necesarios para explicar el flujo.

## 4. Golden Flow documentado

### Baseline

- Una organización autenticada abre la solicitud Golden Flow.
- Ruta: Callao/Lima, Perú → Santiago, Chile.
- Modalidad: ROAD · FTL.
- Carga: 10 pallets, 8,000 kg.
- Estrategia: BALANCED.
- Las tablas comerciales runtime comienzan vacías; el seed prepara el escenario, no ejecuta la demo.

### Orquestación y ranking

1. La UI obtiene la intención de ejecución persistida; el reloj del navegador no recalcula fechas comerciales.
2. CargoMesh crea un orchestration run con una idempotency key nueva.
3. Discovery devuelve `CandidateProvider[0..N]` desde el Provider Registry.
4. El agente navega el `providerUrl` registrado y conserva el `matchingServiceId` exacto.
5. En cada provider ejecuta `check_service_coverage`, `check_capacity` y `quote_freight` mediante `document.modelContext`.
6. El agente abandona el documento y confirma que las tools del provider desaparecieron.
7. El Result Bridge correlaciona y persiste nueve ejecuciones y tres `CarrierOffer` en el Golden Flow.
8. BALANCED genera el ranking canónico 89/84/72 y confianza 88 sin reglas por carrier.
9. El ViewModel termina en `OPTIONS_READY` y presenta una colección variable `0..N`.

### Selección, booking y status

1. La recomendación no selecciona automáticamente.
2. Una persona autorizada elige una oferta en modo `ASSISTED`.
3. `POST /api/bookings/prepare` prepara una autorización server-side.
4. El agente navega el provider exacto y ejecuta `book_freight` mediante WebMCP.
5. El Booking Bridge persiste el resultado y devuelve el `bookingId` de CargoMesh.
6. La UI consume únicamente `BookingViewModel v1`.
7. `get_provider_booking_status` actualiza el ciclo hasta `CONFIRMED`, `REJECTED`, `EXPIRED` o `CANCELLED`.

### Rechazo recuperable

1. El provider devuelve un rechazo comercial válido; no se presenta como error técnico.
2. CargoMesh conserva el booking y sus eventos.
3. El ViewModel expone solo las alternativas permitidas en `recoveryOfferIds`.
4. El usuario confirma una alternativa; el nuevo booking conserva `replacesBookingId`.
5. El Judge Drawer permite seguir navegación, tools, persistencia, decisión y eventos sin fabricar actividad cliente.

## 5. Estados de replay e idempotencia

| Superficie | Primera ejecución | Replay esperado | Evidencia final requerida |
|---|---|---|---|
| Orchestration run | Crea run y ejecuta providers | Misma idempotency key devuelve el run existente sin nueva navegación ni tools | Mismo `runId`; cero ejecuciones WebMCP adicionales |
| Result Bridge de cotización | Inserta evento/oferta correlacionados | Un `toolCallId` ya procesado se deduplica | Mismas ofertas; cero eventos u ofertas duplicados |
| Booking prepare | Crea autorización de selección | Misma selección ASSISTED y key devuelve autorización deduplicada | `deduplicated:true` y misma identidad de booking |
| Provider `book_freight` | Devuelve `idempotentReplay:false` | Repite la reserva provider-side con `idempotentReplay:true` | Misma referencia provider |
| Booking Bridge inicial | Usa bridge call phase `initial` | Usa una identidad distinta con phase `provider-replay` | HTTP 200, estado `DEDUPLICATED`, mismo `bookingId` |
| Persistencia booking | Crea booking, decisión y eventos causales | No crea nuevas filas comerciales | Cero bookings, decisiones o eventos duplicados |
| Provider status | Persiste eventos nuevos | Polls repetidos deduplican eventos por identidad provider | Cronología estable sin eventos repetidos |

### Evidencia sanitizada de INT-03 cerrado

La repetición real publicada en PR #24 se ejecutó en un navegador compatible con `document.modelContext` y confirmó:

- la llamada inicial creó la autorización y persistió el booking;
- repetir la misma selección e idempotencia devolvió `prepare` HTTP 200 y `record-provider` HTTP 200;
- el provider informó `idempotentReplay:true` y el Bridge respondió `DEDUPLICATED`;
- el replay conservó el mismo `bookingId` y la misma referencia provider;
- la identidad del Bridge distinguió las fases `initial` y `provider-replay`;
- antes del reset existía exactamente un booking y cero bookings duplicados;
- el caso `REJECTED` expuso únicamente las alternativas autorizadas por `recoveryOfferIds`;
- la selección de recovery creó un booking de reemplazo ligado al booking rechazado y terminó en `CONFIRMED`;
- cada booking conservó tres eventos y tres bridge calls deduplicados;
- el Judge Drawer mostró las ejecuciones mediante `document.modelContext`, las cinco tools descubiertas y la cronología procedente del `BookingViewModel v1`;
- todas las navegaciones terminaron con `cleanupToolNames: []`.

INT-03 está cerrado. REL-02 continúa como borrador porque REL-01, la URL pública, el video, las capturas y la validación externa todavía están pendientes.

## 6. Ejecución desde una sesión limpia

### Requisitos

- Git.
- Node.js 22 o superior.
- Corepack/pnpm.
- Docker en ejecución.
- Supabase CLI disponible mediante `npx`.
- Navegador que implemente la API WebMCP utilizada por el proyecto.

### Instalación local

```bash
git clone https://github.com/Chujutak2024/cargomesh.git
cd cargomesh
git checkout main

cd frontend
corepack enable
pnpm install --frozen-lockfile
cd ..

npx supabase start
npx supabase db reset
```

Crear `frontend/.env.local` a partir de `frontend/.env.example` y completar únicamente con los valores generados o autorizados para la instancia local. Variables requeridas:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_CARGOMESH_TOOL_CALLER_ORIGINS
SUPABASE_SERVICE_ROLE_KEY
```

Reglas:

- no imprimir, grabar ni compartir valores;
- no enviar `.env.local` a Git;
- `SUPABASE_SERVICE_ROLE_KEY` se usa únicamente server-side;
- configurar solo orígenes provider explícitamente autorizados para la sesión local.

### Verificación y arranque

```bash
cd frontend
pnpm typecheck
pnpm build
pnpm dev
```

Abrir `http://localhost:3000`, iniciar la sesión demo mediante el mecanismo configurado por el proyecto y ejecutar:

```text
/login
→ /dashboard
→ /freight-request/new
→ submit real, sin ?scenario=
→ /dispatch/<runId>
→ selección ASSISTED
→ /booking/<requestCode>/status
```

Los parámetros `?scenario=` se reservan para regresión visual. No son evidencia del Golden Flow real. El reset debe realizarse solo mediante el mecanismo server-side autorizado y limitado al escenario demo.

### Smoke test de sesión limpia

- login → dashboard sin errores;
- intake muestra la intención persistida;
- submit real no agrega `?scenario=`;
- discovery acepta `0..N` providers;
- cada provider expone únicamente sus tools y hace cleanup al salir;
- ranking consume ofertas persistidas;
- selección ASSISTED no ocurre automáticamente;
- booking/status consume el BookingViewModel;
- replay conserva identidad y no duplica datos;
- bundle cliente no contiene secretos.

## 7. Matriz de evidencia por integrante

### Integrante A — WebMCP / Agent Integration

Debe aportar:

- navegador y versión compatibles;
- `getTools()` por documento provider;
- input/output sanitizado de cobertura, capacidad, quote, booking y status;
- evidencia de navegación cross-origin y `matchingServiceId` exacto;
- cleanup después de cada provider;
- evidencia publicada de INT-03 real, replay provider-side, rechazo y recovery;
- timestamps y referencias técnicas sanitizadas necesarias para correlación.

### Integrante B — Product / Frontend y narrativa

Debe aportar:

- historia Devpost y declaración de transparencia;
- guion final menor a tres minutos y ensayo cronometrado;
- capturas de login, intake, ranking, booking, recovery y Judge Drawer;
- evidencia responsive de escritorio y móvil;
- teclado, foco visible, controles accesibles y ausencia de scroll horizontal;
- explicación visual de estados `loading`, `error`, `NO_MATCH`, `OPTIONS_READY`, booking y recovery;
- edición del video, subtítulos y orden de capturas.

### Integrante C — Backend / Decision Data e integración

Debe aportar:

- diagrama de arquitectura y fronteras server/client;
- evidencia del Provider Registry dinámico `0..N`;
- Result Bridge y Booking Bridge con correlación e idempotencia;
- conteos runtime antes/después y ausencia de duplicados;
- ranking BALANCED, scores y confianza;
- ViewModels finales de orchestration y booking;
- pruebas DB, RLS, build, inspección de bundle y entorno limpio;
- URL del despliegue y procedimiento de reset seguro cuando REL-01 lo autorice.

## 8. Pendientes antes de convertirlo en entrega

- [ ] Recibir de C la arquitectura final y la evidencia de entorno limpio de REL-01.
- [ ] Reemplazar referencias locales por la URL pública aprobada en REL-01.
- [ ] Capturar CAP-01 a CAP-10 con estilo y resolución uniformes.
- [ ] Ensayar el guion con los tres integrantes y confirmar duración menor a tres minutos.
- [ ] Revisar que video, imágenes y texto no expongan secretos ni credenciales.
- [ ] Ejecutar la validación externa desde una sesión limpia contra la URL pública.
- [ ] Realizar revisión cruzada A/B/C.

REL-02 debe permanecer sin marcar hasta que REL-01 esté cerrado, una persona ajena al equipo pueda reproducir el Golden Flow y los tres integrantes aprueben el material final.
