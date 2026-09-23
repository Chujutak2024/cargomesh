# Modelo de dominio conceptual UML — CargoMesh V2

**Estado:** propuesta para validación del equipo; no es DER, migración, contrato de API ni prueba de capacidades live. El 23 sep 2026 se actualizó el contraste `as-is` tras aplicar las migraciones de idempotencia y ROAD al Supabase enlazado. Fuente editable: [01-domain-conceptual.drawio](./diagrams/review-2026-09-24/01-domain-conceptual.drawio). Se regenera con `node docs/v2-amazon/diagrams/review-2026-09-24/generate-domain-uml.mjs`, tomando como base el [layout manual compartido](./diagrams/review-2026-09-24/01-domain-user-layout-source.drawio.xml).

El modelo representa **conceptos del negocio** mediante clases sin operaciones, atributos y asociaciones UML con multiplicidad en ambos extremos. Conserva la disposición manual de las cuatro páginas compartidas y añade una quinta para preferencias, perfiles e historial. Las clases que reaparecen en distintas páginas son la **misma** clase, no duplicados del sistema. Los nombres están en español para la revisión; equivalencias del contrato/código: `FreightRequest` = SolicitudDeFlete, `CarrierService` = ServicioDelCarrier, `TransportPlanCandidate` = PlanCandidato, `CarrierOpportunity` = OportunidadDelCarrier, `CarrierOffer` = OfertaDelCarrier, `ScoringPolicy` = PolíticaDeRanking y `Booking` = ReservaDeTransporte.

## 1. Clases conceptuales y atributos

| Vista | Clase | Atributos esenciales | Sentido de negocio |
|---|---|---|---|
| Solicitud | Organización | nombreComercial, razónSocial, identificaciónFiscal, paísDeRegistro, monedaBase, segmentoCliente, estado | Shipper/tenant; segmentoCliente es propuesta V2, no columna actual. |
| Solicitud | SedeDelCliente | código, nombre, tipoDeSede, ubicación, códigoPostal, coordenadas, instruccionesDeAcceso, activa | Punto propio opcional; `facilities` ya existe, sin filas V2 remotas. No sustituye una ubicación libre. |
| Solicitud | SolicitudDeFlete | código, origen, destino, ventanaDeRecojo, límiteDeEntrega, tipoDeServicio, modosAceptados, equipoRequeridoOPreferido, presupuestoMáximo, objetivoDeSelección, estado, versiónDelBorrador | Necesidad y preferencias de esta solicitud, aún no oferta ni reserva. |
| Solicitud | EspecificaciónDeCarga | categoría, descripción, pesoTotalKg, volumenTotalM3, embalaje, divisibilidad, temperaturaMinMax, restriccionesDeManipulación, documentosDisponibles, instruccionesEspeciales | Las restricciones comprenden frío, fragilidad, peligrosidad, sobredimensión, alto valor y apilabilidad; no son puntos de ranking. |
| Solicitud | UnidadDeCarga | tipoDeUnidad, cantidad, pesoPorUnidadKg, volumenPorUnidadM3, dimensiones, unidadesPorBulto, apilable, indivisible | Piezas, pallets, contenedores u otras unidades; permite comprobar límites físicos. |
| Cobertura | Carrier | nombreComercial, tipoDeOperador, paísDeRegistro, canalDeRespuesta, contactoOperativo, identificadorComercial, estado | Canal V2 propuesto; `supports_webmcp` remoto es legado, no capacidad V2. |
| Cobertura | SedeDelCarrier | código, nombre, ubicación, códigoPostal, coordenadas, activa | `carrier_depots` ya existe, sin filas remotas. Horario y capacidad de manipulación siguen como ampliación conceptual, no columnas de HAC-21; su existencia **no** otorga cobertura. |
| Cobertura | ServicioDelCarrier | modo, claseDeServicio, cargasAdmitidas, capacidadMáximaKg, volumenMáximoM3, rangoDeTemperatura, manejoEspecial, cruceFronterizo, coordinaciónAduanera, estadoYVigencia | Servicio publicado; aduana coordinada no equivale a permiso aprobado. |
| Cobertura | ÁreaDeServicio | rolRecojoOEntrega, inclusiónOExclusión, granularidad, paísRegiónCiudadOCódigoPostal, fuentePropiaOSocio, referenciaSocio, evidencia, verificadaEn, vigencia, activa | `service_areas` ya existe para país/región/ciudad/código postal; no almacena aún geometrías poligonales ni un socio como entidad propia. |
| Cobertura | LaneDeServicio | áreaDeRecojo, áreaDeEntrega, tipoDirectoOLocal, modoROAD, requiereRevisiónFronteriza, evidencia, verificadaEn, vigencia, activa | `service_lanes` ya existe y es dirigida. Frecuencia, permisos concretos y otros modos siguen propuestos, no columnas HAC-21. |
| Cobertura | ActivoDeTransporte | códigoDeUnidad, tipoDeEquipo, configuración, capacidadÚtilKg, volumenÚtilM3, pesoBrutoMáximoKg, dimensionesÚtiles, capacidadEspecial, baseOperativa, estadoYFuente | Unidad física identificable; un estado global no prueba disponibilidad en una fecha. |
| Cobertura | CupoContratado | modo, tramo, capacidadDeclarada, unidadDeCapacidad, ventana, socioResponsable, evidencia, vigencia | Capacidad publicada sin inventar un activo individual; propuesta V2. |
| Plan | PlanCandidato | ventanaPropuesta, serviciosPorTramo, ruta, recursosNecesarios, estadoDeCobertura, estadoDeDisponibilidad, requisitosPendientes, costoEstimado, motivosDeExclusión | Alternativa aún no cotizada/confirmada. |
| Plan | RutaPropuesta | origen, destino, distanciaEstimadaKm, duraciónEstimada, peajesEstimados, costosDeFrontera, fuenteGeográfica, confianzaYVigencia | Estimaciones trazables, no tarifa ni permiso confirmados. |
| Plan | TramoDeRuta | orden, origen, destino, modo, distanciaKm, duraciónEstimada, servicioResponsable, requisitosDeFrontera | Segmento modal; requisito fronterizo no implica autorización. |
| Plan | RecursoDelPlan | funciónPortadoraOAuxiliar, tipoDeEquipo, cantidad, ventana, activoOCupo, capacidadAplicable, disponibilidad, fuenteDeVerificación | Asignación por plan/ventana; un auxiliar no aporta capacidad portadora. |
| Mercado | OportunidadDelCarrier | carrierInvitado, planPropuesto, fechaDeInvitación, plazoDeRespuesta, canalDeRespuesta, estado, trazabilidad | Invitación a responder, no cotización. |
| Mercado | OfertaDelCarrier | referenciaDelCarrier, precio, moneda, desgloseDeCosto, recargos, descuentoAutorizado, ETA, capacidadReservable, vigencia, condiciones, fuenteYEstado | Cotización atribuible al carrier; nunca sintetizada por CargoMesh. |
| Mercado | PolíticaDeRanking | versión, objetivo, dimensiones, ponderaciones, normalización, reglaDeFaltantes, desempate | Reglas reproducibles; no reutilizar pesos BALANCED V1. |
| Mercado | OpciónComparada | posición, puntaje, desglose, explicación, datosFaltantes, versiónDePolítica, ofertaEvaluada | Resultado derivado, no oferta ni tabla obligatoria. |
| Mercado | ReservaDeTransporte | ofertaAceptada, autorizadoPor, autorizadoEn, estadoDeSolicitud, estadoDelCarrier, referenciaDelCarrier, confirmadoEn | Autorización y confirmación son hechos diferentes. |
| Contexto | PreferenciasDelCliente | objetivoDeSelección, esperaMáxima, presupuestoHabitual, modoPreferido, equipoPreferido, carrierPreferido, vigencia | Sugerencias del tenant; no saltan filtros duros ni autorizan booking automático. |
| Contexto | PerfilDeCarga | nombre, categoría, métodoDeEntrada, cantidadHabitual, pesoPorUnidad, dimensiones, requisitos, equipoPreferido | Precarga una solicitud nueva; siempre se revalida. |
| Contexto | CategoríaDeCarga | nombre, descripción, requisitosSugeridos, equipoSugerido, métodoDeEntradaSugerido | Taxonomía/guía, no requisito rígido universal. |
| Contexto | MétricaOperativa | período, corredor, modo, categoría, envíosCompletados, envíosExitosos, retrasoMedioHoras, tamañoDeMuestra, fuente | Rendimiento con muestra y período; calificación no se inventa. |

La ubicación, ventana, dinero, dimensiones y fuente son **valores conceptuales**, no nuevas tablas obligatorias. Tampoco se exige implementar estas clases como clases JavaScript/React. La vista [02-domain-classes.drawio](./diagrams/review-2026-09-24/02-domain-classes.drawio) sigue siendo técnica/exploratoria y sus métodos no pertenecen a este modelo conceptual.

## 2. Asociaciones y multiplicidades propuestas

La notación `A (x) — (y) B` significa que **cada B** se asocia con `x` instancias de A y **cada A** con `y` instancias de B. Los números aparecen junto a los extremos correspondientes en el diagrama.

| Relación | Multiplicidad | Regla o reserva |
|---|---|---|
| Organización presenta SolicitudDeFlete | Organización (1) — (0..*) Solicitud | Cada solicitud pertenece a una organización. |
| Organización registra SedeDelCliente | Organización (1) — (0..*) Sede | Puede no tener sedes registradas. |
| SolicitudDeFlete describe EspecificaciónDeCarga | Solicitud (1) — (1) Especificación | Una especificación por solicitud en este corte. |
| EspecificaciónDeCarga contiene UnidadDeCarga | Especificación (1) — (1..*) Unidad | Al enviar, debe haber al menos una unidad; un borrador incompleto puede existir antes. |
| SedeDelCliente es origen de Solicitud | Sede (0..1) — (0..*) Solicitud | Rol `origin_facility_id` opcional; si se usa, pertenece a la misma organización que la solicitud. |
| SedeDelCliente es destino de Solicitud | Sede (0..1) — (0..*) Solicitud | Rol `destination_facility_id` opcional y con la misma restricción de organización. Una misma sede podría desempeñar ambos roles; su validez comercial se decide por caso de uso. |
| Carrier publica ServicioDelCarrier | Carrier (1) — (0..*) Servicio | Sin lista fija de carriers. |
| Carrier opera SedeDelCarrier | Carrier (1) — (0..*) Sede | Cero sedes propias no implica ausencia de cobertura por socio. |
| ServicioDelCarrier declara ÁreaDeServicio | Servicio (1) — (0..*) Área | Áreas de recojo y entrega diferenciadas. |
| ServicioDelCarrier declara LaneDeServicio | Servicio (1) — (0..*) Lane | La lane es dirigida y versionada. |
| Carrier dispone de ActivoDeTransporte | Carrier (1) — (0..*) Activo | Incluye activo gestionado por socio identificado; titularidad/fuente requiere precisión posterior. |
| ServicioDelCarrier puede usar CupoContratado | Servicio (1) — (0..*) Cupo | Cupo ≠ vehículo físico inventado. |
| LaneDeServicio une ÁreaDeServicio | Lane (0..*) — (2) Área | Exactamente un área `PICKUP` incluida y otra `DELIVERY` incluida, ambas del mismo servicio. Es una abreviatura visual de **dos asociaciones con rol**, no dos extremos intercambiables. |
| SolicitudDeFlete genera PlanCandidato | Solicitud (1) — (0..*) Plan | Puede no haber alternativas elegibles. |
| PlanCandidato propone RutaPropuesta | Plan (1) — (1) Ruta | Cardinalidad inicial; revisar si se guardarán rutas alternativas por plan. |
| RutaPropuesta contiene TramoDeRuta | Ruta (1) — (1..*) Tramo | Admite itinerario multimodal. |
| ServicioDelCarrier participa en PlanCandidato | Servicio (1..*) — (0..*) Plan | Un plan tiene al menos un servicio; un servicio puede aparecer en muchos planes. |
| PlanCandidato requiere RecursoDelPlan | Plan (1) — (1..*) Recurso | Por tramo/ventana; portador y auxiliar se distinguen. |
| RecursoDelPlan usa ActivoDeTransporte | Recurso (0..*) — (0..1) Activo | Si se identifica unidad física, se valida su disponibilidad. |
| RecursoDelPlan usa CupoContratado | Recurso (0..*) — (0..1) Cupo | **XOR conceptual:** cada recurso refiere activo **o** cupo, no ambos ni ninguno al confirmar. |
| PlanCandidato se propone como OportunidadDelCarrier | Plan (1) — (0..*) Oportunidad | Una alternativa puede proponerse a varios carriers, sin inventar oferta. |
| OportunidadDelCarrier recibe OfertaDelCarrier | Oportunidad (1) — (0..*) Oferta | Varias revisiones solo si el contrato comercial lo autoriza; decisión pendiente. |
| Carrier es invitado a OportunidadDelCarrier | Carrier (1) — (0..*) Oportunidad | Una oportunidad tiene un destinatario responsable. |
| Carrier emite OfertaDelCarrier | Carrier (1) — (0..*) Oferta | Debe coincidir con el destinatario de la oportunidad, salvo contrato de intermediación explícito. |
| OfertaDelCarrier fundamenta ReservaDeTransporte | Oferta (1) — (0..1) Reserva | No se crea booking sin autorización y oferta vigente. |
| OfertaDelCarrier produce OpciónComparada | Oferta (1) — (0..*) Opción | La misma oferta puede evaluarse bajo distintas versiones de política. |
| PolíticaDeRanking calcula OpciónComparada | Política (1) — (0..*) Opción | Se conserva la versión para reproducibilidad. |
| Organización define PreferenciasDelCliente | Organización (1) — (0..1) Preferencias | Son defaults, no autorizaciones ni datos de otro tenant. |
| Organización guarda PerfilDeCarga | Organización (1) — (0..*) Perfil | Repetir precarga datos; no hereda tarifa, capacidad ni permisos. |
| PerfilDeCarga se clasifica en CategoríaDeCarga | Perfil (0..*) — (1) Categoría | La categoría orienta entrada y requisitos. |
| Carrier tiene MétricaOperativa | Carrier (1) — (0..*) Métrica | Agregado por período, corredor y muestra; puede no haber historial. |

## 3. Contraste con la base de datos

El export compartido por el usuario es anterior a las migraciones V2 y **no debe usarse como fotografía actual**. El 23 sep 2026 se aplicaron al proyecto Supabase enlazado **`cargomesh`** (`tokvzfrefwqobzqgbfoj`) las migraciones `20260918120000_c_draft_creation_idempotency` y `20260922053512_v2_road_facilities_services`. El historial remoto las registra; las cuatro tablas ROAD existen con RLS y políticas, y están vacías. La vista conceptual combina vocabulario de negocio confirmado por ese esquema con conceptos objetivo todavía no materializados. Véase [FL-02](../04-execution/friction-logs/FL-02.md).

| Lo que aporta el esquema existente | Tratamiento en el modelo V2 |
|---|---|
| `organizations`: nombre legal, país, identificador empresarial, moneda y estado | Se incorporan atributos de negocio de Organización. `segmentoCliente` queda como propuesta, no columna existente. |
| `freight_requests`: direcciones/contactos, ventana, deadline, presupuesto, modo, tipo de servicio, peso/volumen, indicadores de carga y versión; ahora también `origin_facility_id` y `destination_facility_id` opcionales | Se distribuyen entre Solicitud, Especificación y Unidad. Las dos FK compuestas exigen que la sede elegida pertenezca a la organización de la solicitud. No se asume que todos los estados SQL V1 sean estados V2. |
| `freight_requests.creation_idempotency_key` + `creation_payload_hash` | Confirman la identidad del reintento de creación, con índice único, control de dueño y recibo inmutable. Son invariantes técnicos del agregado Solicitud, **no** dos atributos de negocio que deban llenar la caja UML conceptual; sí pertenecen al modelo lógico/API y sus pruebas. |
| `facilities` y `carrier_depots`: código, nombre, geografía estructurada, coordenadas opcionales pareadas y bandera `active` | Confirman SedeDelCliente y SedeDelCarrier como conceptos persistidos. La primera pertenece a una organización; la segunda a un carrier. El depot no prueba cobertura. Horario y manejo del depot siguen pendientes. |
| `service_areas`: servicio, rol `PICKUP`/`DELIVERY`, inclusión/exclusión, granularidad COUNTRY/REGION/CITY/POSTAL_CODE, fuente OWN/PARTNER, referencia de socio, evidencia y vigencia | Confirma ÁreaDeServicio con cobertura declarada. No hay geometría poligonal ni entidad de socio independiente. La exclusión específica y la elegibilidad son reglas del servicio de aplicación, no un efecto automático de la FK. |
| `service_lanes`: servicio, área de recojo, área de entrega, tipo DIRECT/WITHIN_AREA, modo ROAD, indicador de revisión fronteriza, evidencia y vigencia | Confirma LaneDeServicio dirigida. FKs y triggers exigen extremos del mismo servicio y rol correctos; una lane local requiere igual geografía. No hay frecuencia, permisos concedidos, ETA, tarifa, modo no ROAD ni lane inversa implícita. |
| `carrier_services` y `vehicles`: límites físicos, capacidades especiales, modo y clase | En Servicio y Activo. `vehicles.status = AVAILABLE` no sustituye agenda, reservas ni disponibilidad por fecha. |
| `carrier_offers`, `freight_decisions` y `bookings`: precio, vigencia, desglose, score y autorización | Se aprovecha el vocabulario, pero oferta V2, política versionada y booking real requieren contratos/pruebas propios. El `final_score` V1 no es la PolíticaDeRanking V2. |
| `organization_preferences`, `organization_cargo_profiles`, `cargo_categories`, `carrier_metrics` | Motivan la quinta vista conceptual. Sus filas y defaults son heredados; no se presentan como lógica de recomendaciones V2 terminada. |
| Sin tablas V2 para cupos, agenda, planes, oportunidades o política | Son conceptos propuestos. No convertir ausencia de tabla en dato confirmado ni dibujar FKs ficticias. |

El layout compartido reubicó bien las clases. Corregí una asociación movida por accidente (`ÁreaDeServicio → CupoContratado`): el cupo está ligado al **ServicioDelCarrier**, y retiré una línea duplicada sin nombre entre servicio y área. Las cardinalidades y asociaciones restantes conservan la revisión anterior.

**Consecuencia para el DER posterior:** dibujar `freight_requests → facilities` como dos FK opcionales con rol y organización compuesta; `carrier_services → service_areas` como 1 a 0..*; `service_lanes → service_areas` como dos FK obligatorias y distintas (recojo/entrega) del mismo servicio; `carriers → carrier_depots` como 1 a 0..*. El DER debe incluir claves, índices, `CHECK`, vigencia y RLS, que deliberadamente no saturan el modelo de dominio UML. Ni la aplicación de la migración ni la presencia de tablas vacías cierran el contrato de capacidad por fecha o discovery.

## 4. Límites y preguntas para aprobar

- Esta es una **propuesta de estructura conceptual**; las multiplicidades de oferta revisada, ruta por plan y activo/cupo deben ratificarse con el equipo antes del DER lógico.
- `0..*` en catálogo no significa elegibilidad. Área, lane, carga, permisos y capacidad para la ventana son filtros duros; ausencia de dato produce `unknown`.
- `OpciónComparada` es derivada, no estado persistido ni cotización. `ReservaDeTransporte` no representa confirmación automática.
- La capacidad real exige reservas, mantenimiento, reposicionamiento y concurrencia; esos detalles van al modelo de capacidad/estado posterior, no se reducen a un atributo booleano del activo.
- `PreferenciasDelCliente` y `PerfilDeCarga` no validan automáticamente una oferta pasada. `MétricaOperativa` exige período, tamaño de muestra y fuente; no se muestra una calificación de estrellas si no existe una reseña verificada.
- No se mezclan fixtures, carriers, scores ni herramientas WebMCP V1 como hechos de V2.

**Fuentes de gobernanza:** [DOMAIN_CONTRACTS](./DOMAIN_CONTRACTS.md), [CARRIER_COVERAGE_AND_SERVICEABILITY](./CARRIER_COVERAGE_AND_SERVICEABILITY.md), [TRANSPORT_PLANS_AND_FLEET](./TRANSPORT_PLANS_AND_FLEET.md), [CARRIER_DISCOVERY_AND_RANKING](./CARRIER_DISCOVERY_AND_RANKING.md). La aprobación conceptual precede al DER; no se cambia Supabase ni Linear con este archivo.
