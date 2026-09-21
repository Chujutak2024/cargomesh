# CargoMesh V2 — Taxonomía Industrial de Cargas, Dimensiones y Modelo de Precios en USD
## Especificación de Tipos de Carga, Factor Volumétrico (CBM) y Recargos Dinámicos

> **Estado documental:** este archivo describe la **arquitectura objetivo V2**. Las capacidades que aún no existen en el código deben tratarse como `TARGET/PLANNED`; el flujo MCP ya validado y los componentes existentes no deben reescribirse solo para coincidir con este documento.

> 📚 **Suite Documental de Arquitectura V2:**  
> • **Blueprint Maestro:** [CARGOMESH_V2_EVOLUTION_BLUEPRINT.md](./CARGOMESH_V2_EVOLUTION_BLUEPRINT.md)  
> • **Esquema de Base de Datos:** [DATABASE_SCHEMA_V2_PROPOSAL.md](./DATABASE_SCHEMA_V2_PROPOSAL.md)  
> • **Diagramas de Dominio y Persistencia:** [BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md](./BACKEND_DOMAIN_AND_PERSISTENCE_DIAGRAMS.md)  
> • **Taxonomía de Carga y Precios USD:** [CARGO_DIMENSIONS_AND_TAXONOMY_V2.md](./CARGO_DIMENSIONS_AND_TAXONOMY_V2.md) *(Este documento)*  
> • **Plan Operativo y Sprints:** [MASTER_BACKLOG.md](./MASTER_BACKLOG.md)

---

## 🧭 1. El Problema en V1 vs. La Realidad Logística en V2

En la versión anterior (V1), las cargas estaban restringidas a 4 códigos genéricos (`MACHINERY`, `GENERAL`, `AGRICULTURAL`, `CONSTRUCTION`) y asumían que todo era un simple pallet de peso estático.

En la logística industrial real (especialmente minería, retail transfronterizo y química):
1. **El flete no solo se cobra por peso:** Se cobra por la relación entre **Peso Real vs. Peso Volumétrico (CBM)** según la regla internacional **W/M (Weight or Measurement)**.
2. **La apilabilidad es dinero:** Una carga liviana pero no apilable (`is_stackable: false`) ocupa todo el piso del camión o contenedor, impidiendo cargar otros bultos.
3. **El tipo de carga altera drásticamente el costo en dólares (USD):** Mover ácido sulfúrico (HAZMAT) o vacunas refrigeradas a -20°C cuesta entre 25% y 40% más que mover cajas secas, debido a seguros, combustible de generadores térmicos y choferes con certificaciones especiales.

---

## 📦 2. Nueva Taxonomía de Tipos de Carga (6 Categorías Industriales)

Reemplazamos las etiquetas genéricas por categorías alineadas con los estándares internacionales (IATA, IMO y regulaciones de aduanas Perú-Chile):

```mermaid
graph TD
    CARGO["Tipos de Carga Industrial (CargoMesh V2)"]

    CARGO --> C1["⛏️ MINING_BULK<br>(Concentrados de Cobre, Zinc, Litio y Tolvas)"]
    CARGO --> C2["🚜 HEAVY_MACHINERY<br>(Excavadoras, Motores Industriales, Cama-Baja)"]
    CARGO --> C3["❄️ COLD_CHAIN_PERISHABLE<br>(Agroexportación, Alimentos, Farmacéutica -20°C a +4°C)"]
    CARGO --> C4["☣️ HAZMAT_CHEMICALS<br>(Ácidos, Reactivos Mineros, Explosivos, Clases IMO 1-9)"]
    CARGO --> C5["💎 HIGH_VALUE_CRITICAL<br>(Sensores, Repuestos Aéreos Críticos > $50K USD)"]
    CARGO --> C6["📦 GENERAL_MERCHANDISE<br>(Carga Seca Consolidada, Retail, Pallets Estándar)"]
```

### Detalle de las 6 Categorías Industriales:

| Código de Categoría | Nombre en la Plataforma | Activo Típico de Transporte | Requerimientos Operativos | Multiplicador Base USD |
|---|---|---|---|---|
| **`MINING_BULK`** | Concentrados y Mineral a Granel | Tolvas herméticas 6x4, Vagón tolva ferroviario | Báscula de pesaje 60T, control de humedad (TML) | $\times 1.15$ (Desgaste severo) |
| **`HEAVY_MACHINERY`** | Maquinaria Pesada y Sobredimensionada | Plataforma Cama-baja (Lowboy) | Escolta vial, permisos de carretera por exceso de gálibo | $\times 1.40$ + Permisos (\$450 USD) |
| **`COLD_CHAIN`** | Perecibles y Cadena de Frío | Furgón / Contenedor Reefer con Thermo King | Monitoreo térmico continuo, generador gen-set | $\times 1.30$ (Combustible térmico) |
| **`HAZMAT`** | Materiales Peligrosos y Químicos | Cisternas o furgones con rombos IMO | Chofer con licencia A-IV, kit antiderrame, hoja MSDS | $\times 1.25$ a $\times 1.40$ (Riesgo/Seguro) |
| **`HIGH_VALUE`** | Repuestos Críticos y Alto Valor | Furgón blindado o Carga Aérea express | Precinto satelital GPS, escolta armada, seguro all-risk | $\times 1.20$ + Póliza Ad-Valorem |
| **`GENERAL_DRY`** | Mercadería General y Seca | Furgón estándar FTL o Contenedor 40HC | Paletizado estándar, montacargas tradicional | $\times 1.00$ (Tarifa Base) |

---

## 📏 3. Dimensiones Físicas, Cubicaje (CBM) y Peso Imputable (Chargable Weight)

Para evitar pérdidas financieras a los transportistas y cobrar precios justos en dólares, CargoMesh implementa el cálculo estándar de **Peso Imputable**:

### A. Metros Cúbicos (CBM):
$$\text{CBM} = \left( \frac{\text{Largo (cm)} \times \text{Ancho (cm)} \times \text{Alto (cm)}}{1,000,000} \right) \times \text{Cantidad de Bultos}$$

### B. Peso Volumétrico según el Modo de Transporte:
* **Transporte Carretero (Factor Terrestre):** $1 \text{ CBM} \approx 333 \text{ kg} \quad \left( \text{Peso Volumétrico} = \frac{\text{Largo} \times \text{Ancho} \times \text{Alto}}{3,000} \right)$
* **Carga Aérea (Factor IATA):** $1 \text{ CBM} \approx 167 \text{ kg} \quad \left( \text{Peso Volumétrico} = \frac{\text{Largo} \times \text{Ancho} \times \text{Alto}}{6,000} \right)$
* **Cabotaje Marítimo (Regla W/M):** $1 \text{ CBM} \approx 1,000 \text{ kg}$ ($1 \text{ Tonelada}$ métrica)

### C. Peso Imputable (Chargable Weight):
$$\text{Peso Imputable (kg)} = \max(\text{Peso Bruto Real (kg)}, \text{Peso Volumétrico (kg)})$$

---

## 🏷️ 4. Atributos Esenciales que se Incorporan a la Carga

La solicitud de flete en V2 incluye atributos operativos que antes faltaban:

1. **`packaging_type` (Tipo de Embalaje):**
   * `PALLET_STANDARD_WOOD`: Pallet de madera 120x100 cm.
   * `PALLET_EURO`: Pallet europeo 120x80 cm.
   * `CONTAINER_20GP`: Contenedor 20 pies seco.
   * `CONTAINER_40HC`: Contenedor 40 pies High Cube.
   * `BIG_BAG`: Bolsa industrial de 1 a 2 toneladas para mineral.
   * `DRUM_BARREL`: Cilindros de acero/plástico de 200 L para químicos.
   * `WOODEN_CRATE`: Caja de madera para maquinaria o repuestos delicados.

2. **`is_stackable` (Factor de Apilabilidad):**
   * `BOOLEAN`: Si es `FALSE`, la carga **no soporta peso encima**.
   * `max_stacking_tiers`: Si es apilable, indica cuántos niveles soporta (ej. 2 o 3 bultos de altura).
   * *Impacto en Precio:* Una carga **no apilable** aplica automáticamente un **recargo del +20%**, ya que anula la capacidad vertical del camión o buque.

3. **`declared_value_usd` (Valor Comercial Declarado en Dólares):**
   * Permite cotizar el seguro de carga obligatorio:  
     $$\text{Costo Seguro USD} = \text{declared\_value\_usd} \times 0.0035 \quad (0.35\% \text{ del valor de la mercadería})$$

4. **`hazmat_class` (Clasificación IMO para Materiales Peligrosos):**
   * Clase 1 (Explosivos), Clase 2 (Gases), Clase 3 (Líquidos Inflamables), Clase 8 (Corrosivos/Ácidos), Clase 9 (Misceláneos).
   * `un_number`: Código internacional de 4 dígitos de la ONU (ej. `UN 1830` para Ácido Sulfúrico).

---

## 💲 5. Pricing de Referencia y Oferta del Carrier

La taxonomía de carga sirve tanto para calcular un **benchmark** como para permitir que un carrier `AUTO/HYBRID` calcule su oferta. El precio final que entra a `carrier_offers` pertenece al carrier.

### Componentes de costo

```text
deadhead del carrier al origen
+ distancia cargada / tramo internacional
+ handling de puertos/aeropuertos/terminales
+ aduana/frontera
+ carga / volumen / peso imputable
+ requisitos especiales
+ margen y descuentos del carrier
```

Una fórmula de referencia para auto-oferta puede ser:

$$
\text{Oferta USD} =
[(D_{deadhead} + D_{cargada}) \times TarifaBase + Handling + Nodos + Aduana]
\times M_{carga}
\times M_{apilabilidad}
+ S_{especiales}
- D_{comercial}
$$

### Consideraciones internacionales por modo

| Modo | Infraestructura relevante | Variables adicionales |
|---|---|---|
| ROAD | depots, border posts, customs warehouses | peajes, frontera, descanso, deadhead |
| MARITIME | puertos, container yards, aduana | handling, TEU, W/M, cut-off |
| AIR | cargo terminals, aeropuertos, almacén temporal | peso volumétrico, handling, urgencia |
| RAIL | terminal ferroviario/intermodal | km-ton, transferencia y last mile |

### Manual vs auto-oferta

- `MANUAL`: la taxonomía ayuda al operador del carrier a cotizar, pero el humano envía la oferta.
- `AUTO`: las reglas del carrier usan estos atributos para emitir `quote_freight`.
- `HYBRID`: cargas sensibles pasan a revisión humana.

CargoMesh puede mostrar al shipper un rango estimado, pero no debe confundir ese benchmark con una `CarrierOffer` real.

## 💻 6. Contrato TypeScript (Zod) Actualizado para Creación de Carga

```typescript
import { z } from "zod";

export const CargoCategoryCodeSchema = z.enum([
  "MINING_BULK",
  "HEAVY_MACHINERY",
  "COLD_CHAIN",
  "HAZMAT",
  "HIGH_VALUE",
  "GENERAL_DRY",
]);

export const PackagingTypeSchema = z.enum([
  "PALLET_STANDARD_WOOD",
  "PALLET_EURO",
  "CONTAINER_20GP",
  "CONTAINER_40HC",
  "BIG_BAG",
  "DRUM_BARREL",
  "WOODEN_CRATE",
]);

export const CargoDimensionsSpecificationSchema = z.object({
  categoryCode: CargoCategoryCodeSchema.default("GENERAL_DRY"),
  packagingType: PackagingTypeSchema.default("PALLET_STANDARD_WOOD"),
  
  // Conteo y unidades
  packageUnitsCount: z.number().int().positive().default(1),
  unitLengthCm: z.number().positive(),
  unitWidthCm: z.number().positive(),
  unitHeightCm: z.number().positive(),
  unitGrossWeightKg: z.number().positive(),
  totalGrossWeightKg: z.number().positive(),
  
  // Propiedades físicas y estiba
  isStackable: z.boolean().default(true),
  maxStackingTiers: z.number().int().min(1).default(1),
  
  // Control térmico y seguridad
  requiresRefrigeration: z.boolean().default(false),
  targetTemperatureCelsius: z.number().min(-30).max(25).nullable().optional(),
  
  // Peligrosidad
  isHazardous: z.boolean().default(false),
  hazmatClass: z.enum(["IMO_1", "IMO_2", "IMO_3", "IMO_4", "IMO_5", "IMO_6", "IMO_7", "IMO_8", "IMO_9"]).nullable().optional(),
  unNumber: z.string().regex(/^UN\d{4}$/).nullable().optional(),
  
  // Valor comercial para seguro en USD
  declaredValueUsd: z.number().positive().nullable().optional(),
});
```

---

## 🗄️ 7. Extensión de Base de Datos en Supabase (DDL SQL Aditivo)

```sql
-- 1. Nuevos Enumeradores de Carga y Empaque
CREATE TYPE cargo_category_v2_enum AS ENUM (
    'MINING_BULK',
    'HEAVY_MACHINERY',
    'COLD_CHAIN',
    'HAZMAT',
    'HIGH_VALUE',
    'GENERAL_DRY'
);

CREATE TYPE packaging_type_enum AS ENUM (
    'PALLET_STANDARD_WOOD',
    'PALLET_EURO',
    'CONTAINER_20GP',
    'CONTAINER_40HC',
    'BIG_BAG',
    'DRUM_BARREL',
    'WOODEN_CRATE'
);

-- 2. Extensión a freight_requests
ALTER TABLE public.freight_requests
    ADD COLUMN IF NOT EXISTS cargo_category_v2 cargo_category_v2_enum DEFAULT 'GENERAL_DRY',
    ADD COLUMN IF NOT EXISTS packaging_type packaging_type_enum DEFAULT 'PALLET_STANDARD_WOOD',
    ADD COLUMN IF NOT EXISTS total_cbm numeric(10, 3),
    ADD COLUMN IF NOT EXISTS chargable_weight_kg numeric(12, 2),
    ADD COLUMN IF NOT EXISTS is_stackable boolean DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS max_stacking_tiers integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS hazmat_class text,
    ADD COLUMN IF NOT EXISTS un_number text,
    ADD COLUMN IF NOT EXISTS declared_value_usd numeric(14, 2);
```

---

## 🎯 8. Relación de la Taxonomía con el Marketplace

La taxonomía V2 no existe solo para mejorar el precio. También determina **elegibilidad de carriers y nodos logísticos**:

- HAZMAT exige permisos y nodos compatibles.
- COLD_CHAIN exige vehículo/reefer y energía disponible en depot/terminal.
- HEAVY_MACHINERY requiere activos y accesos compatibles.
- Contenedores marítimos requieren puertos/terminales y tipos de contenedor soportados.
- AIR requiere terminales de carga aérea y reglas de peso volumétrico.

Por tanto, el flujo es:

```text
CargoSpecification
→ Carrier / Infrastructure Compatibility
→ FreightOpportunity
→ Manual or Auto Offer
→ CarrierOffer
→ Deterministic Ranking
```

El Golden Flow puede seguir usando fixtures sintéticos de Andes/Inca/Pacific, siempre que la documentación y la demo indiquen que los carriers y sus respuestas son datos de escenario.
