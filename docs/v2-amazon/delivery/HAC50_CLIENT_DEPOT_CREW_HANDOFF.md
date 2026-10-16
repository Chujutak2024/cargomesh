# Coordinación con backend Cliente — sedes y agenda Carrier

La rama Carrier `codex/unified-workspaces-demo-boundary` añade políticas de operación y citas por sede, y conecta conductores/calendarios/asignaciones existentes. La migración remota de sedes sigue pendiente de autorización y conexión al proyecto correcto. No asumir que ya está instalada.

El Cliente expresa origen/destino, ventanas, tolerancia/flexibilidad, urgencia y requisitos de carga/equipo. El Carrier publica servicios/cobertura, agenda y su oferta. El Cliente no modifica las licencias, horarios ni asignaciones internas del Carrier.

Al evaluar un plan, conservar sus sedes realmente participantes y actividades necesarias. Comprobar cobertura del servicio, luego sede/actividad/horario/equipo/cupo si utiliza esa sede, y recursos/conductores. Una sede no concede cobertura de su país ni toda la cobertura del servicio se atribuye automáticamente a una base. La recogida directa puede no necesitar un muelle propio.

Las consultas `POST /api/v2/carrier-portal/carriers/:carrierId/availability` y `.../depots/:depotId/operations/availability` son del portal Carrier y requieren esa identidad. No reutilizar una sesión Cliente para llamar esos endpoints ni ampliar grants. El motor de planes debe consumir los mismos servicios a través de un caso de uso autorizado de discovery, con proyección pública mínima y sin exponer licencias/contactos/agenda completa.

`RESOURCE_WINDOW_ONLY` no significa plan elegible ni booking. `unknown` debe producir revisión/dato pendiente; no prometer fecha, capacidad o costo. Cambiar ruta/duración/fecha exige revalidar ventanas. Confirmar debe comprobar versiones y obtener oferta atribuible; el Cliente decide. Registrar una cita, una asignación o mover una tarea no confirma una oferta ni un booking.

La cita tiene su propia versión y estados PROPOSED/CONFIRMED/CANCELLED/COMPLETED. Antes de cancelar/completar una ejecución con citas futuras confirmadas, liberarlas mediante comando auditado. La coordinación de cancelación completa entre agregados requiere un caso de uso explícito, idempotente y probado; no repartir mutaciones en el navegador y presentarlas como transacción atómica.

Pendientes: proyección autorizada del plan que incluya decisiones de sede y recursos; búsqueda de fecha próxima; alternativas de otros carriers tras fallo; vínculo operativo entre booking, tramo, ejecución y citas; pruebas cruzadas con scopes independientes. No crear un segundo pedido en el portal Carrier ni trasladar el antiguo Edit request a su flujo conectado.

## Contrato de comprobación operativa — 15-oct

Ya implementado localmente el agregador Carrier de lectura de recursos y sedes. Contrato, límites y evidencia: [HAC50_OPERATIONAL_ASSESSMENT_HANDOFF_2026-10-15.md](./HAC50_OPERATIONAL_ASSESSMENT_HANDOFF_2026-10-15.md). No es endpoint Cliente ni confirma factibilidad completa/reserva. Reutilizarlo requiere el caso de uso autorizado de discovery descrito allí.
