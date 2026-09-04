import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Gauge,
  MapPin,
  Route,
  ShieldCheck,
  Truck,
  Waypoints,
  Zap,
} from "lucide-react";

import { translate } from "@/features/i18n/config";
import { getRequestLocale } from "@/features/i18n/server";
import styles from "./providers-directory.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: `${translate(locale, "Carriers WebMCP", "WebMCP Carriers")} | CargoMesh`,
    description: translate(
      locale,
      "Directorio de carriers conectados mediante WebMCP (document.modelContext) en CargoMesh.",
      "Directory of carriers connected via WebMCP (document.modelContext) in CargoMesh.",
    ),
  };
}

const REQUIRED_TOOLS = [
  "check_service_coverage",
  "check_capacity",
  "quote_freight",
  "book_freight",
  "get_provider_booking_status",
] as const;

const LIVE_CARRIERS = [
  {
    slug: "andes",
    code: "ANDES_DEMO",
    serviceCode: "ANDES-PECL-FTL",
    name: "Andes Express",
    score: 89,
    scoreLabel: "Recomendado",
    scoreLabelEn: "Recommended",
    mode: "ROAD (Carretera)",
    modeEn: "ROAD (Highway)",
    serviceType: "FTL (Carga Completa)",
    serviceTypeEn: "FTL (Full Truckload)",
    capacity: "24,000 kg · 70 m³",
    vehicle: "Scania R450",
    corridor: "Callao / Lima, PE ➔ Santiago, CL",
    crossBorder: true,
    transitHours: 31,
    demoPrice: "$1,760 USD",
    reasons: [
      "Mejor balance entre costo y confiabilidad",
      "Capacidad FTL confirmada para ventana programada",
    ],
    reasonsEn: [
      "Best balance between cost and reliability",
      "Confirmed FTL capacity for scheduled window",
    ],
  },
  {
    slug: "inca",
    code: "INCA_DEMO",
    serviceCode: "INCA-PECL-FTL",
    name: "Transportes Inca",
    score: 84,
    scoreLabel: "Menor tránsito",
    scoreLabelEn: "Fastest transit",
    mode: "ROAD (Carretera)",
    modeEn: "ROAD (Highway)",
    serviceType: "FTL (Carga Completa)",
    serviceTypeEn: "FTL (Full Truckload)",
    capacity: "22,000 kg · 65 m³",
    vehicle: "Volvo FH",
    corridor: "Callao / Lima, PE ➔ Santiago, CL",
    crossBorder: true,
    transitHours: 29,
    demoPrice: "$1,920 USD",
    reasons: [
      "Menor tiempo de tránsito en corredor internacional",
      "Alta confiabilidad histórica y fallback de recovery",
    ],
    reasonsEn: [
      "Shortest transit time on international corridor",
      "High historical reliability and recovery fallback",
    ],
  },
  {
    slug: "pacific",
    code: "PACIFIC_DEMO",
    serviceCode: "PACIFIC-PECL-FTL",
    name: "Pacific Cargo",
    score: 72,
    scoreLabel: "Económico",
    scoreLabelEn: "Budget",
    mode: "ROAD (Carretera)",
    modeEn: "ROAD (Highway)",
    serviceType: "FTL (Carga Completa)",
    serviceTypeEn: "FTL (Full Truckload)",
    capacity: "20,000 kg · 60 m³",
    vehicle: "Freightliner",
    corridor: "Callao / Lima, PE ➔ Santiago, CL",
    crossBorder: true,
    transitHours: 60,
    demoPrice: "$1,590 USD",
    reasons: [
      "Menor tarifa cotizada en el corredor",
      "Ventana de disponibilidad acotada",
    ],
    reasonsEn: [
      "Lowest quoted rate in corridor",
      "Constrained pickup availability window",
    ],
  },
];

const ROADMAP_CARRIERS = [
  {
    name: "Polaris Transport",
    code: "POLARIS",
    tag: "Dato de escenario / Roadmap",
    tagEn: "Scenario seed / Roadmap",
    description: "Especialista en carga pesada y minería en zonas altoandinas. Fixture sintético para pruebas de volumen extremo.",
    descriptionEn: "Heavy-haul specialist for high-altitude mining. Synthetic fixture for extreme volume testing.",
  },
  {
    name: "Apex Logistics",
    code: "APEX",
    tag: "Dato de escenario / Roadmap",
    tagEn: "Scenario seed / Roadmap",
    description: "Operador de enlace fronterizo Tacna / Arica. Fixture sintético para validaciones de cruce bilateral.",
    descriptionEn: "Border shuttle operator Tacna / Arica. Synthetic fixture for bilateral crossing validations.",
  },
  {
    name: "Velocity Express",
    code: "VELOCITY",
    tag: "Dato de escenario / Roadmap",
    tagEn: "Scenario seed / Roadmap",
    description: "Distribución de repuestos críticos y paquetería urgente en rutas interprovinciales.",
    descriptionEn: "Critical spare parts express delivery on interprovincial routes.",
  },
];

export default async function ProvidersDirectoryPage() {
  const locale = await getRequestLocale();
  const isSpanish = locale === "es";

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            {translate(locale, "Google WebMCP Challenge 2026 · Registered Providers", "Google WebMCP Challenge 2026 · Registered Providers")}
          </span>
          <h1>{translate(locale, "Red de Carriers WebMCP", "WebMCP Carriers Network")}</h1>
          <p>
            {translate(
              locale,
              "Directorio operativo de transportistas conectados mediante el estándar WebMCP. Cada carrier opera un host independiente con tools en document.modelContext para consulta de cobertura, capacidad, cotización determinística y reserva transfronteriza.",
              "Operational directory of carriers connected via WebMCP. Each carrier runs an independent host with tools in document.modelContext for coverage queries, capacity, deterministic quoting, and cross-border booking.",
            )}
          </p>
        </div>
      </header>

      <section className={styles.statsBar} aria-label={translate(locale, "Métricas de la red WebMCP", "WebMCP network metrics")}>
        <div className={styles.statCard}>
          <span className={styles.statIcon} aria-hidden="true"><Truck size={20} /></span>
          <div className={styles.statText}>
            <small>{translate(locale, "Carriers en vivo", "Live carriers")}</small>
            <strong>3 {translate(locale, "Providers WebMCP", "WebMCP Providers")}</strong>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon} aria-hidden="true"><Zap size={20} /></span>
          <div className={styles.statText}>
            <small>{translate(locale, "Tools registradas", "Registered tools")}</small>
            <strong>15 {translate(locale, "Tools en document.modelContext", "Tools in document.modelContext")}</strong>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon} aria-hidden="true"><Route size={20} /></span>
          <div className={styles.statText}>
            <small>{translate(locale, "Corredor principal", "Primary corridor")}</small>
            <strong>Callao (PE) ➔ Santiago (CL)</strong>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon} aria-hidden="true"><Gauge size={20} /></span>
          <div className={styles.statText}>
            <small>{translate(locale, "Motor de decisión", "Decision engine")}</small>
            <strong>BALANCED (6 {translate(locale, "dimensiones", "dimensions")})</strong>
          </div>
        </div>
      </section>

      <div className={styles.sectionHeader}>
        <h2>{translate(locale, "Providers WebMCP Operativos", "Active WebMCP Providers")}</h2>
        <span className={styles.sectionBadge}>
          <span className={styles.dotLive} aria-hidden="true" />
          3 LIVE HOSTS
        </span>
      </div>

      <section className={styles.grid} aria-label={translate(locale, "Lista de carriers WebMCP", "WebMCP carriers list")}>
        {LIVE_CARRIERS.map((carrier) => (
          <article key={carrier.slug} className={styles.carrierCard}>
            <div className={styles.carrierCardHeader}>
              <div className={styles.carrierIdentity}>
                <div className={styles.carrierIconBox} aria-hidden="true">
                  <Truck size={22} />
                </div>
                <div className={styles.carrierTitles}>
                  <h3>{carrier.name}</h3>
                  <small>{carrier.code} · {carrier.serviceCode}</small>
                </div>
              </div>
              <div className={styles.scoreBadge}>
                <strong>{carrier.score}<small> pts</small></strong>
                <small>{isSpanish ? carrier.scoreLabel : carrier.scoreLabelEn}</small>
              </div>
            </div>

            <div className={styles.carrierDetails}>
              <div className={styles.detailItem}>
                <span>{translate(locale, "Modalidad / Servicio", "Mode / Service")}</span>
                <strong>{isSpanish ? carrier.mode : carrier.modeEn}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>{translate(locale, "Capacidad Máx.", "Max Capacity")}</span>
                <strong>{carrier.capacity}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>{translate(locale, "Tránsito Estimado", "Estimated Transit")}</span>
                <strong>{carrier.transitHours} h</strong>
              </div>
              <div className={styles.detailItem}>
                <span>{translate(locale, "Tarifa Demo (FR-1042)", "Demo Rate (FR-1042)")}</span>
                <strong>{carrier.demoPrice}</strong>
              </div>
            </div>

            <div className={styles.toolsSection}>
              <div className={styles.toolsHeading}>
                <span>5 Tools WebMCP en document.modelContext:</span>
              </div>
              <ul className={styles.toolsList}>
                {REQUIRED_TOOLS.map((toolName) => (
                  <li key={toolName} className={styles.toolPill}>
                    <CheckCircle2 size={12} aria-hidden="true" />
                    {toolName}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.cardFooter}>
              <span className={styles.statusLive}>
                <span className={styles.dotLive} aria-hidden="true" />
                {translate(locale, "Host WebMCP activo", "WebMCP host active")}
              </span>
              <Link href={`/providers/${carrier.slug}`} className={styles.primaryBtn}>
                {translate(locale, "Ver Portal Carrier", "Open Carrier Portal")}
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.sectionHeader} style={{ marginTop: "1.5rem" }}>
        <h2>{translate(locale, "Transportistas de Escenario & Roadmap", "Scenario & Roadmap Carriers")}</h2>
        <span className={styles.sectionBadge} style={{ background: "#f0f3f2", color: "#52605e" }}>
          ROADMAP ONLY
        </span>
      </div>

      <section className={styles.roadmapGrid} aria-label={translate(locale, "Carriers de roadmap", "Roadmap carriers")}>
        {ROADMAP_CARRIERS.map((carrier) => (
          <div key={carrier.code} className={styles.roadmapCard}>
            <div>
              <span className={styles.roadmapTag}>
                {isSpanish ? carrier.tag : carrier.tagEn}
              </span>
              <h4 style={{ marginTop: "0.4rem" }}>{carrier.name} ({carrier.code})</h4>
            </div>
            <p>{isSpanish ? carrier.description : carrier.descriptionEn}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
