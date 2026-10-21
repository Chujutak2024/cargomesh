# Activación de cotización Cliente–Carrier

Rama registrada: `codex/unified-workspaces-demo-boundary` (HAC-50). Base de este corte: main `1a52624`. Autorización funcional: «Ya, hay que configuralo» del 20-oct-2026. No abre ramas auxiliares ni declara el gate o Linear Done por escribir este documento.

## Entrega

- Cliente: revisión/presentación explícita del pedido, búsqueda de ofertas, casos históricos propios, acceso al contexto de Nova y comparación de hasta tres alternativas conocidas.
- Carrier: política de tarifa por servicio/lane aprobada por ADMIN, con fuente, desglose, vigencia, versión y recibo idempotente. Emisión mediante adaptador interno autorizado, sin suplir al Carrier con un precio del modelo.
- Backend: ruta/plan/oportunidad/oferta/ranking nativos, filtros duros y revalidación. Búsquedas posteriores reutilizan oportunidades actuales y pueden usar una política recién aprobada, sin invitaciones duplicadas.
- Booking: sigue pendiente hasta confirmar recursos. Prórroga propuesta por Carrier y aprobada por Cliente; plazo vencido impide confirmación y puede cerrarse con cancelación/liberación nativa. Sin proceso periódico nuevo de cancelación.

Contrato: [QUOTE_AUTOMATION](../contracts/QUOTE_AUTOMATION.md). Receta separada: [v2-client-carrier-quotes](../../../supabase/scenarios/v2-client-carrier-quotes/README.md).

## Ledger alojado y dependencias

Lectura real mediante Supabase CLI2.117.0, `db query --linked --project-ref yhimeajpzicjbxpbzsyh`, dentro de `begin read only`/`rollback`. Al preparar el corte, el alojado tiene 31 migraciones. La dependencia mínima de este incremento es:

1. `20261015055541` — operaciones de sedes/depot.
2. `20261015122904` — proyección de oferta en booking.
3. `20261019190034` — proyección de pedido para Carrier.
4. `20261019202113` — preparación de oferta y versión del pedido.
5. `20261020234155` — políticas/dispatch, historial y plazo de confirmación.

Antes de ejecutar, releer el ledger y regenerar el cierre; no aplicar versiones ya presentes. Verificar hashes LF del manifiesto y propietario postgres. La transacción de esquema incluye ledger y DDL; no incluye cuentas, precios ni datos sintéticos. Las migraciones fronterizas y de modelos visuales faltantes no pertenecen a este paquete mínimo.

## Escenario propuesto

El catálogo actual tiene un Carrier y calendarios sintéticos con ventanas de octubre8–12. No se actualizan ni sobrescriben esas filas para hacerlas parecer vigentes. Se propone un servicio nuevo, recurso de10t/30m³, disponibilidad21–25oct y KEEP_DRY simulado. Tarifa demo: **USD500 fija por viaje**, oferta de hasta120min y confirmación de30min, siempre limitada a la vigencia. El ADMIN demo real ya existe; no requiere nuevas cuentas o grants.

La receta reutiliza un corredor HAC44 de100km rotulado SIMULATED; no certifica una distancia vial real Lima–Arequipa ni acceso para camiones. El runner usa Auth real y RPCs nativos con claves estables; se detiene ante drift. No crea pedidos, ofertas, bookings, retenciones o conductores. Solo la búsqueda explícita emite las ofertas correspondientes.

## Evidencia proporcional

- `supabase/tests/40_v2_quote_automation.test.sql`: emisores/usuarios separados, permisos y RLS, centavos, replay/conflictos, versión obsoleta, privacidad, ausencia de reservas al cotizar, consentimiento de prórroga, vencimiento y reuso sin duplicados. El banco local aislado se elimina al finalizar; no usa datos Auth comerciales existentes.
- `quote-automation.test.ts` y `shipper-offer-context.test.ts`: no fabricar precios históricos, límite de presentación y contexto propio de Nova.
- Tipos y arquitectura; `check-quote-scenario.ts` valida los nueve comandos y la tarifa de la receta sin escribir datos.
- Gate de integración requerido: `.github/workflows/v2-qa-gate.yml` sobre el SHA entregado. Los resultados locales no sustituyen ese gate.
- La validación visual/manual del recorrido corresponde al equipo; no se impone captura como permiso para continuar. La implementación de texto conversacional sigue determinista; no se anuncia una nueva integración de texto Bedrock.

## Publicación y comprobación final

El AGENTS.md recibido congela main: este corte necesita su excepción explícita para PR/merge y el despliegue automático. La preparación no modifica Root Directory, productionBranch, alias, variables de Vercel ni AWS.

Tras autorización: gate del commit → paquete DDL mínimo → escenario/tarifa aprobada → merge autorizado y Vercel READY del mismo SHA → lecturas nativas de elegibilidad/historial/ofertas y grant de Nova. El primer pedido y contratación se confirman explícitamente; no se adelanta En camino al aceptar una oportunidad o autorizar booking.

Para desactivar, retirar la política con su versión actual mediante el ADMIN Carrier, sin borrar ofertas/historial ni revertir DDL histórico. Una regresión funcional requiere corte correctivo o reversión de código autorizada; no borrar entidades ya comprometidas.

## Resultado local del incremento

Comprobaciones ejecutadas el 20-oct: 37 pgTAP PASS en banco Docker aislado con fixture transaccional revertido y banco eliminado; 15 pruebas Node PASS; TypeScript y arquitectura PASS (657 módulos /196 entradas), UML/DER vigentes PASS. Receta validada con nueve comandos y tarifa, sin escritura alojada.

La proyección nativa exportada desde SQL pasa los schemas de producción y los consumidores reales de comparación Cliente y briefing de Nova: una oferta USD237.01, ranking almacenado y recomendación1 coinciden. Ese precio pertenece únicamente al fixture SQL; el escenario alojado propuesto usa USD500 SIMULATED y aún no se ejecutó. No se certifica micrófono humano ni validación visual.

Lectura alojada al preparar la entrega:31 migraciones,1 servicio,7 assets,6 calendarios antiguos; pedido demo permanece DRAFTv1. El ADMIN Carrier nativo ya existe. No hay nuevas órdenes, cotizaciones ni bookings alojados de esta entrega. El gate CI, publicación y activación se registrarán con sus resultados reales.

La lectura actual de Linear muestra HAC-50 Done como historia; este incremento nuevo no cambia ese estado ni afirma una nueva aceptación. Mantiene la rama existente por la continuidad autorizada por Cristhian. El registro del nuevo alcance y el target a main requieren la excepción de publicación vigente.
