# CargoMesh — Checklist del equipo
> **Versión:** 1.3.0 — plan operativo de un día, 2026-09-01.
> **Base contrastada:** main `17e3c0e`. La planificación cambia; los contratos de ejecución no se modifican por este documento.
> **Historial:** [checklist v1.2 completo](CargoMesh_Team_Execution_Checklist_v1.2_History.md). Sus instrucciones de trabajo “hoy” y tipos copiados son históricos, no el plan vigente.
> **Encargos y mapa:** [handoff de un día](CargoMesh_One_Day_Handoff.md). **Diagnóstico:** [respuesta.md](../../respuesta.md).

## 1. Resultado que necesitamos hoy

Una persona autenticada crea una carga distinta del ejemplo, recibe una sugerencia basada en antecedentes autorizados mediante WebMCP, elige qué reutilizar, edita y guarda, consulta providers, selecciona y reserva. Después encuentra su solicitud y estado real en el dashboard.

**Momento demostrable:** “Reutiliza esta orden similar” → modal con fuente/campos → aplicar → cambiar peso/fecha → guardar → ejecutar tools → resultado coherente con esos cambios.

No es suficiente mostrar pantallas con fixtures ni nombres de tools. Se permite simular al transportista; no simular que una ejecución, autorización o persistencia ocurrió cuando no ocurrió.

## 2. Cuatro entregas activas

Son cuatro resultados del día, no cuatro PR gigantes. Cada integrante entrega cortes pequeños; un cambio independiente no espera al resto. No abrir otra serie de documentos EXP-00..09.

- [ ] **D1-01 — Nueva carga editable y persistida**
  - **Owner:** C backend; B formulario y contrato de presentación; revisa A la frontera con providers.
  - **Referencia:** maestro §2.4/§32; auditoría §2–3.
  - **Construir:** crear/editar borrador con ruta y contactos separados, categoría/método coherentes, totales, fechas y presupuesto; guardar/confirmar; inputs del runner desde esa versión persistida. Reutilizar lectura de PR #35 donde corresponda, sin convertirla en escritura.
  - **Aceptación:** no depende de FR-1042; editar y recargar conserva datos; fechas editables y válidas; perfil cambia datos con consentimiento; categoría visible y código coinciden; identidad/organización derivadas de sesión. BALANCED sigue siendo la política disponible.
  - **Verificar:** crear una solicitud desde UI, cambiar carga y agenda, guardar/recargar y comparar payload persistido/inputs provider; error de acceso o validación no cae a fixture ni inicia tools.

- [ ] **D1-02 — Recomendación contextual mediante WebMCP**
  - **Owner:** C algoritmo/datos; A registro y ejecución WebMCP; B modal y aplicación.
  - **Referencia:** maestro §5/§7; auditoría §4.1.
  - **Construir:** algoritmo simple de similitud por categoría/ruta y recencia; tool de consulta de sugerencias; mostrar fuente y campos reutilizables; aplicar selección al borrador, con edición/deshacer. No entrenar modelos.
  - **Aceptación:** invocación observable mediante document.modelContext; cerrar/rechazar no cambia nada; no pisa ediciones posteriores; no copia fechas vencidas, precio vigente, booking ni autorización. Sin historial devuelve ausencia de sugerencia.
  - **Verificar:** antecedente similar, sin coincidencias y cambio de borrador entre sugerir/aplicar; comprobar invocación, efecto visible y guardado, además de aislamiento por organización.

- [ ] **D1-03 — Casos coherentes y dashboard del usuario**
  - **Owner:** A seeds/fixtures y compatibilidad provider; C lectura/autorización e integración de datos; B dashboard/detalle.
  - **Referencia:** maestro §21/§32; auditoría §4.3–4.4.
  - **Construir:** caso nacional, internacional y negativo; antecedentes sintéticos separados del runtime de la nueva solicitud; dashboard por organización con lista/detalle y sin métricas inventadas. Corregir la exigencia transfronteriza incondicional en cobertura.
  - **Aceptación:** los casos positivos llegan al resultado esperado y el negativo rechaza por una causa visible; la nueva solicitud aparece tras guardarla; sin registros hay estado vacío. Los seeds no precargan ofertas/decisiones/bookings de la corrida por ejecutar.
  - **Verificar:** carga y repetición local del seed sin duplicación; manifests por caso; recorrido UI de los tres escenarios; probar otra organización. Mapa según §6, sin contarlo como completo si solo hay un dibujo.

- [ ] **D1-04 — Flujo integrado y retomable, validado como usuario**
  - **Owner:** C integra; A valida WebMCP; B UX; usuario revisa dos cortes.
  - **Referencia:** maestro §32; auditoría §7.
  - **Construir:** progreso durante consultas, resultados persistidos, booking/replay/recovery existentes y relectura/reconstrucción autorizada del contexto al volver a abrir la reserva.
  - **Aceptación:** funciona sin preparar manualmente el resultado, sin usar ?scenario= como evidencia real y sin depender exclusivamente del sessionStorage de una pestaña. Compatibilidad WebMCP se comunica antes del submit. Ningún error produce éxito ficticio.
  - **Verificar:** corte 1 nueva carga+sugerencia+guardado; corte 2 consulta+selección+booking+replay/recovery; abrir reserva en contexto autenticado sin su caché local. Capturar SHA, navegador, IDs de la corrida, resultados y límites. Pruebas relevantes, typecheck/build; DB/RLS solo cuando cambien sus módulos.

## 3. Quién hace qué, sin bloquearse

| Integrante | Empieza ya | Límite y revisión |
|---|---|---|
| **A** | Continuar seeds encargados por el usuario, manifest nacional/internacional/negativo; revisar cobertura; proponer tool de sugerencias | No scoring ni UI de B. Excepción acotada de datos: paquete seed separado sobre schema vigente; C revisa/aplica. No tocar remoto, Auth ni RLS |
| **B** | Contratos de presentación y pruebas del formulario/modal/lista; inputs editables, contactos separados, estados vacíos y progreso | B propone campos/errores necesarios, C confirma API/autorización y A confirma inputs WebMCP. No consultas privilegiadas ni endpoints ficticios presentados como reales |
| **C** | Guardado/confirmación, algoritmo contextual, lectura del dashboard y contexto de reserva; gestionar #35 | No absorber diseño UI ni implementación provider. Cambios de persistencia/seguridad con revisión cruzada |

A puede implementar el módulo de registro/runtime de nuevas tools CargoMesh; B conecta su ciclo de vida a las páginas. Esa coordinación no autoriza a A a reescribir los componentes de B.

### Acuerdo corto de contrato, no otra fase de documentación

En el primer corte de trabajo, B propone y A/C acuerdan en el PR:
- borrador: datos editables, versión/updatedAt, validación y forma de confirmar;
- sugerencia: fuente, motivo, campos propuestos, versión del borrador y campos aceptados;
- resumen/detalle de solicitud: identidad, carrier solo cuando corresponda, estado y acciones;
- si se implementa movimiento: ubicación/ruta/vehículo, tiempo simulado y relación con booking/evento.

Estos son requisitos de consumo, no nombres definitivos de endpoints ni nuevos DTO ya aprobados. Reusar contratos actuales cuando sirven. Los desacuerdos se resuelven en el mismo PR; solo los cambios incompatibles necesitan una decisión adicional.

## 4. Contratos que no se rompen

- Organización/membresía y autorización se validan server-side; la caché no autoriza.
- Se conservan las cinco tools provider y sus esquemas, ProviderToolEnvelope, CandidateProvider, matchingServiceId exacto, origins autorizados y cleanup.
- Recomendación ≠ aplicación al borrador ≠ confirmación ≠ selección ≠ booking ≠ aceptación del provider.
- Tools nuevas del intake son capacidades de CargoMesh, no una sexta tool impuesta a cada carrier. Cleanup se verifica por ámbito/origin: tools propias de CargoMesh no se confunden con tools provider que deben desaparecer.
- Result Bridge de quote y Booking/Status Bridge continúan separados. No reutilizar IDs ni alterar conflictos/replay para esconder incompatibilidades.
- No editar silenciosamente una solicitud ya evaluada/reservada: rechazar la operación o crear una nueva versión/solicitud según contrato acordado; no sobrescribir el snapshot de una corrida.
- No añadir campos a JSON Schema estricto ni cambiar enums sin actualizar productores, validadores, consumidores y pruebas. Una ampliación de tracking se versiona si la compatibilidad lo exige.
- Histórico sintético y runtime de nueva corrida se distinguen; no usar historial seed para mantener fingidamente los scores previos del Golden Flow.

Fuentes ejecutables: [provider](../../frontend/src/features/providers/contracts.ts), [booking provider](../../frontend/src/features/providers/provider-booking-contracts.ts), [Booking Bridge](../../frontend/src/features/booking/contracts.ts), [orquestación](../../frontend/src/features/orchestration/contracts.ts), [execution intent](../../frontend/src/features/freight-requests/execution-intent-contracts.ts), [ADR-001](../00-master/ADR-001_Dynamic_Provider_Registry.md).

Se retiraron de este checklist las copias antiguas de tipos: no deben contradecir las implementaciones aprobadas ni volver a mezclar BookingResult interno con resultado provider.

## 5. PR abiertos: reducir trabajo, no reescribirlos

Estado consultado el 2026-09-01; verificar nuevamente antes de actuar.

| PR | Estado y siguiente acción | No hacer |
|---|---|---|
| [#35](https://github.com/Chujutak2024/cargomesh/pull/35) | Draft, APPROVED en ce69c4d. C gestiona su integración acotada tras verificación final; aprovechar su lectura en detalle/reutilización de existente | No convertirlo en mega-PR ni tomar su handoff read-only como diseño permanente de /new; crear/editar es D1-01 en otro corte |
| [#34](https://github.com/Chujutak2024/cargomesh/pull/34) | Landing Draft en 721948b. B conserva alcance y atiende revisión/rebase si corresponde; el trabajo nuevo va separado | No mezclar formulario, seeds o mapa con landing |
| [#29](https://github.com/Chujutak2024/cargomesh/pull/29) | REL-02 Draft aprobado en 2b1d1bc; actualizar evidencias después de D1-04 | No usar capturas fixture como prueba de ejecución pública |
| [#18](https://github.com/Chujutak2024/cargomesh/pull/18) | Propuesta documental histórica A-04 aún abierta; C/A concilian si quedó reemplazada por implementación | No reabrir desarrollo A-04 ni mergear documentación obsoleta automáticamente |

La publicación de este plan no fusiona esos PRs, no despliega ni autoriza reset remoto.

## 6. Mapa: realismo con alcance limitado

**Propuesta base:** mapa geográfico con origen/destino, línea de ruta de demo declarada y frontera solo internacional; panel del envío con carrier, último evento y ETA disponibles. Reutilizar una solución existente si la hay; B elige la opción más pequeña y documenta procedencia/atribución, sin contratar servicios ni añadir claves por iniciativa propia.

**Mejora condicionada al flujo funcionando:** camión animado sobre una ruta predefinida, reloj simulado reproducible y estados coherentes con eventos provider persistidos. Siempre “Seguimiento simulado”; no GPS real. C/A acuerdan el dato necesario; B no cambia estado comercial desde la animación.

**Recorte explícito si no alcanza el día:** entregar mapa+eventos sin movimiento y declarar el movimiento pendiente. No marcar tracking continuo como entregado ni retrasar creación/sugerencias por el mapa. Detalles y alternativas en [handoff](CargoMesh_One_Day_Handoff.md#mapa-para-b).

## 7. Cadencia y cierre

- Primera coordinación breve: contrato mínimo de consumo y casos. No esperar a un documento extenso.
- C prepara persistencia/algoritmo, A escenarios/tools y B UI/contratos de presentación en paralelo.
- Dos cortes de revisión con el usuario: carga asistida guardada; luego booking/estado.
- Reservar el cierre para integrar y probar. Ante presión de tiempo, recortar movimiento del mapa y mejoras de copy, no autorización ni guardado.
- Cada PR: tarea D1, alcance, contratos tocados, verificación y siguiente consumidor. No es obligatorio abrir un issue adicional por cada subpaso.
- Solo C marca casillas después de main+verificación. PR abierto/aprobado no equivale a integrado; una tarea funcional requiere prueba desde UI con efecto persistido y caso negativo.
- No hay merges automáticos por este documento. El autor conserva ownership y revisión cruzada.

## 8. Entrega final existente

- [ ] **REL-01 — Validar la demo desplegada**
  - **Owner:** C; A WebMCP, B UX.
  - **Construir/verificar:** después de D1-04, confirmar URL/SHA, sesión limpia, casos, replay/recovery, cleanup y bundle sin secretos. La URL ya publicada no significa que este gate esté cerrado.
  - **Aceptación:** persona ajena al equipo completa el flujo sin preparar IDs/resultados ni recibir secretos; limitaciones de simulación visibles.

- [ ] **REL-02 — Entregar material Devpost**
  - **Owner:** B; A evidencia WebMCP y C arquitectura/pruebas.
  - **Construir/verificar:** actualizar PR #29 con historia breve, instrucciones, capturas reales finales y video; separar fixtures de evidencia.
  - **Aceptación:** material consistente con el SHA validado y funciones realmente demostradas. No publica la inscripción/submission automáticamente.

## 9. Historial conservado y discrepancias abiertas

Días 1–3 conservan sus cierres de integración; no significan aceptación de todos los recorridos generales del maestro. Tabla y registro íntegros: [v1.2 histórico](CargoMesh_Team_Execution_Checklist_v1.2_History.md).

| Hito histórico | Evidencia integrada registrada | Brecha a resolver hoy |
|---|---|---|
| B-01 | #4/#13 | Dashboard e identidad visual aún fixture en el corte auditado → D1-03 |
| B-02 / INT-02 | #21/#16 y corrida cross-origin | El submit de una solicitud preparada no equivale a crear/guardar cualquier carga → D1-01 |
| A-03 / C-02 | #9/#10 y bridges/runner posteriores | Cobertura general, variación de casos y visualización de progreso → D1-03/04 |
| A-04 / C-03 / B-03 / INT-03 | #20/#23/#24, correcciones de replay y evidencia registrada | Seguimiento posterior y reapertura sin contexto local → D1-04/mapa |

**Corrección documental explícita:** la frase anterior “los fixtures permanecen limitados a regresión visual” no describe dashboard/intake del main auditado. Se conserva como antecedente en el archivo histórico, no como afirmación vigente.

## 10. Registro del plan

2026-09-01: el usuario limita el trabajo restante a un día, prioriza creación real, asistencia WebMCP y casos coherentes, y autoriza simplificar/publicar el checklist. Se sustituyen los siete/once bloques propuestos por cuatro entregas, manteniendo REL-01/REL-02. Publicar el plan no completa ninguna casilla funcional.

