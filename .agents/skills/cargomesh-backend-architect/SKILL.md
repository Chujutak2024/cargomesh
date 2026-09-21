---
name: cargomesh-backend-architect
description: >-
  Suite maestra para el rol de Desarrollador Backend en CargoMesh V2.
  Estandariza la arquitectura de Hono V2, validación con Zod, sobre { ok, data },
  gobernanza estricta de Supabase (cero datos de prueba en migraciones, 160 tests pgTAP)
  y diseño del endpoint local /mcp con respuestas SSML para Alexa Skills Kit.
---

# CargoMesh Backend Architect Master Suite

Esta suite establece los patrones de arquitectura, contratos de datos y directivas de prueba
para el desarrollo backend en CargoMesh V2.

---

## 🏛️ 1. Arquitectura de Endpoints Hono V2

Ubicación: `cargomesh/src/server/hono/routes/*`

### El Patrón Policy / Server:
- **`*-policy.ts` (Lógica Pura de Negocio):** NO importa `server-only` ni llamadas a base de datos. Recibe tipos planos y dependencias inyectadas. Permite pruebas unitarias ultra-rápidas con `tsx --test`.
- **`*-server.ts` (Adaptador de Infraestructura):** Lleva `import "server-only"`, cliente Supabase Server y ejecuta transacciones SQL. Invoca las funciones puras de `*-policy.ts`.
- **`routes/*.ts` (Controlador HTTP Hono):** Valida esquemas con Zod (`zValidator`), aplica middlewares (`authMiddleware`), delega a `*-server.ts` y responde con el sobre estándar.

### Sobre de Respuesta Canónico (Standard JSON Envelope):
```typescript
// Respuesta exitosa
{ ok: true, data: T }

// Respuesta con error
{
  ok: false,
  error: {
    code: "STALE_DRAFT" | "VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED",
    message: string,
    details?: unknown
  }
}
```

---

## 🧪 2. Gobernanza de Base de Datos y pgTAP (Supabase)

### ❌ Regla de Oro Inviolable:
- **NUNCA agregar datos de prueba (INSERTs de camiones, flotas ficticias, organizaciones demo) en `supabase/migrations/`**.
- Todo archivo en `supabase/migrations/` es exclusivamente para **DDL estructural**: `CREATE TABLE`, `ALTER TABLE`, `ADD CONSTRAINT`, índices y políticas RLS.
- Los datos de prueba y escenarios van estrictamente en:
  - `supabase/scenarios/<scenario-name>/seed.sql` (para escenarios reproducibles como `expanded-fleet`).
  - `supabase/seed.sql` (para usuarios demo iniciales).

### Pruebas de Base de Datos con pgTAP (`supabase/tests/*.test.sql`):
- Toda prueba se ejecuta dentro de una transacción aislada con `BEGIN; ... ROLLBACK;`.
- Estándar actual de la suite: **160 / 160 subtests passing** a lo largo de 8 archivos de prueba.
- Comandos esenciales:
  ```bash
  npx supabase db reset    # Reset limpio y aplicación de migraciones DDL
  npx supabase test db     # Ejecución de las 160 aserciones pgTAP
  ```

---

## 🎙️ 3. Endpoint Local `/mcp` & Alexa Skills Kit (ASK)

El endpoint `/mcp` procesa solicitudes JSON-RPC 2.0 (`tools/call`) provenientes de la consola o Skill de Alexa.

### Herramientas Expuestas:
1. **`create_freight_request`**: Parámetros de origen, destino, categoría de carga, peso y ventana de recogida.
2. **`get_freight_status`**: Consulta de estado por código de seguimiento (`FR-1042`).
3. **`get_freight_request_recommendations`**: Ranking determinístico BALANCED de carriers.

### Formato de Respuestas SSML para Alexa:
```typescript
export function buildAlexaFreightSpeech(trackingCode: string, carrier: string, score: number, cost: number): string {
  return `
    <speak>
      <s>Solicitud registrada con código <say-as interpret-as="spell-out">${trackingCode}</say-as>.</s>
      <break time="250ms"/>
      <s>El transportista recomendado es <emphasis level="moderate">${carrier}</emphasis> con score de ${score} y tarifa de ${cost} dólares.</s>
    </speak>
  `.trim();
}
```

### Prueba de Simulación Local con cURL:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_freight_request",
      "arguments": {
        "origin_city": "Callao",
        "origin_country": "PE",
        "destination_city": "Santiago",
        "destination_country": "CL",
        "cargo_category": "general_merchandise",
        "weight_kg": 18500,
        "pickup_window_start": "2026-10-01T08:00:00Z",
        "pickup_window_end": "2026-10-01T18:00:00Z"
      }
    },
    "id": "alexa-sim-1"
  }'
```
