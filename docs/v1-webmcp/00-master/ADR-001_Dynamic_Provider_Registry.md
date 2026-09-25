# ADR-001 — Registro y descubrimiento dinámico de transportistas

> **Estado:** Aceptado  
> **Fecha:** 2026-08-29  
> **Impacto:** Producto, WebMCP, frontend, orquestación, Supabase y demo

## Decisión

CargoMesh es un marketplace/orquestador B2B de capacidad de transporte terrestre: una empresa publica una necesidad de carga y el sistema descubre, consulta, compara y permite reservar camiones de transportistas registrados.

La analogía interna es una "app on-demand B2B de camiones". En comunicación pública se usará **marketplace B2B de transporte de carga** y no se presentará el producto como una integración limitada a tres empresas.

Andes Freight, Inca Logistics y Pacific Cargo son exclusivamente el conjunto reproducible de fixtures del Golden Flow. No son una lista cerrada de proveedores ni deben aparecer hardcodeados en la lógica de descubrimiento, scoring, UI o booking.

## Invariantes de arquitectura

1. La fuente de candidatos es el registro `carriers` + `carrier_services`, nunca un array de nombres o URLs en código.
2. Una `FreightRequest` puede descubrir cero, uno o N transportistas.
3. Solo se consultan carriers `ACTIVE`, con `supports_webmcp = true`, `provider_url` válido y al menos un servicio compatible.
4. La compatibilidad inicial filtra ruta, modo, tipo de servicio, categoría de carga y restricciones declaradas.
5. La disponibilidad y cotización definitivas se conocen únicamente al ejecutar las tools WebMCP del transportista.
6. El Decision Engine recibe una colección variable de ofertas elegibles y no conoce identidades comerciales concretas.
7. El booking utiliza el `provider_url` y la oferta seleccionada; no contiene ramas especiales para Andes, Inca o Pacific.
8. Los portales de fixture usan la plantilla dinámica `/providers/[carrierSlug]`. Un carrier real también puede registrar una URL externa propia.

## Componentes

### Provider Registry

Supabase mantiene el directorio de transportistas:

- `carriers`: identidad, tipo de operador, estado y URL WebMCP;
- `carrier_services`: corredores, modalidad, capacidad y soporte operativo;
- `carrier_service_cargo_categories`: categorías aceptadas;
- `vehicles`: capacidad disponible para los fixtures de la demo;
- `carrier_metrics`: evidencia histórica usada por el ranking.

El registro es extensible mediante inserciones server-side validadas. El cliente autenticado de una empresa cargadora solo consulta el directorio; no puede activar proveedores ni alterar sus capacidades.

Para el P0 no se requiere una migración adicional: `carriers.code` funciona como identificador estable de la plantilla (`ANDES` ↔ `/providers/andes`) y `provider_url` identifica el endpoint navegable. La ruta dinámica resuelve el carrier en un Server Component o Route Handler y entrega al navegador únicamente la configuración pública necesaria; las credenciales `service_role` nunca se incluyen en el bundle cliente.

### Candidate Discovery

CargoMesh expone `get_candidate_provider_pages(freight_request_id)`. Su resultado es una colección variable:

```json
{
  "freight_request_id": "uuid",
  "candidates": [
    {
      "carrier_id": "uuid",
      "carrier_name": "string",
      "provider_url": "https://...",
      "matching_service_id": "uuid"
    }
  ]
}
```

Esta operación produce candidatos potenciales, no ofertas ni promesas de capacidad.

### WebMCP Orchestration

```text
FreightRequest confirmada
        ↓
get_candidate_provider_pages
        ↓
CandidateProvider[0..N]
        ↓ for each candidate
navigate provider_url → execute WebMCP tools
        ↓
record_provider_result
        ↓
CarrierOffer[0..N]
        ↓
evaluate_offers
        ↓
0 ofertas: orchestration run `NO_MATCH`
1 oferta: opción única explicada
N ofertas: ranking determinista
```

Las páginas provider devuelven resultados estructurados. Solo CargoMesh valida y persiste esos resultados.

## Alcance del hackathon

### P0

- directorio dinámico consultado desde Supabase;
- una plantilla `/providers/[carrierSlug]` para los fixtures;
- tres carriers seed para demostrar competencia y ranking;
- iteración 0..N sin nombres, IDs ni conteos hardcodeados;
- tools WebMCP reales, Result Bridge, ranking, selección y booking;
- estados de UI para búsqueda, cero resultados y número variable de ofertas.

El alta autoservicio y la relación entre usuarios del carrier y su registro quedan fuera del P0. Durante el hackathon, registrar significa crear/validar el carrier y sus servicios mediante una operación server-side o datos seed.

### Después del hackathon

- onboarding autoservicio del transportista;
- verificación documental y aprobación del carrier;
- publicación de servicios y flota desde un portal propio;
- proveedores externos alojando sus propias páginas WebMCP;
- geolocalización y matching de disponibilidad en tiempo real;
- reputación, pagos, seguros y cumplimiento regulatorio.

## Criterios de aceptación

- Registrar un cuarto carrier compatible en Supabase hace que aparezca como candidato sin modificar el código.
- Desactivar un carrier hace que deje de descubrirse sin modificar el frontend.
- Una solicitud sin carriers compatibles termina de forma controlada, sin cards ficticias.
- El Golden Flow sigue produciendo Andes/Inca/Pacific y los scores canónicos usando solo los datos seed.
- Ningún módulo de producción contiene `['ANDES', 'INCA', 'PACIFIC']` como fuente de candidatos.

## Propiedad del equipo

- **WebMCP:** plantilla provider, contratos y navegación sobre `provider_url`.
- **Frontend:** UI basada en colecciones 0..N y estados vacíos.
- **Datos/Decision Engine:** consulta de discovery, Result Bridge y scoring independiente del número de ofertas.
