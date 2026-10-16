# HAC-50: limites operativos de sede no expuestos

15-oct-2026. Auditoria de catalog.ts: CarrierDepot expone code/name/location/active/handling; no horario, capacidad concurrente o vinculo operativo sede-servicio. Facility de Cliente si expone operatingHours/accessRestrictions. Impacto: no acreditar ventana factible basada en una capacidad de sede inexistente ni inferir cobertura del pais.

Tratamiento: red en lectura, pendiente visible; propuesta aditiva de contrato en salida/carrier-supabase-plan-20261014/DEPOT_OPERATING_LIMITS_PROPOSAL.md del workspace principal. No se relajo ningun permiso ni se agregaron campos desconocidos o seeds. Siguiente: auditar agregados/reutilizar primitivas de horario, definir relacion sede-servicio y recursos/ocupacion con RLS/atomicidad/pruebas. No acredita orquestador visual de muelles.
