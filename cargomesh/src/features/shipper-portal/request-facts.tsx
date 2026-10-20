"use client";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import { formatDateTime } from "./shipper-model";
import styles from "./shipper-portal.module.css";
import operations from "./operations.module.css";

export function RequestFacts({ request }: { request: FreightRequestV2Data }) {
  const { t, localeTag } = useLocale(), cargo = request.cargoSpecification;
  const window = (value: FreightRequestV2Data["pickupWindow"]) => `${formatDateTime(value.startsAt, localeTag)} – ${formatDateTime(value.endsAt, localeTag)}`;
  const facts = [
    [t("Versión y última actualización", "Version and last update"), `v${request.draftVersion} · ${formatDateTime(request.updatedAt, localeTag)}`],
    [t("Origen", "Origin"), `${request.origin.label} · ${request.origin.city} · ${request.origin.countryCode}`],
    [t("Destino", "Destination"), `${request.destination.label} · ${request.destination.city} · ${request.destination.countryCode}`],
    [t("Ventana de recojo", "Pickup window"), window(request.pickupWindow)],
    [t("Ventana de entrega", "Delivery window"), window(request.deliveryWindow)],
    [t("Carga y embalaje", "Cargo and packaging"), `${cargo.description} · ${cargo.packaging}`],
    [t("Unidades declaradas", "Declared units"), cargo.units.map(unit => `${unit.quantity} × ${unit.weightPerUnitKg.toLocaleString(localeTag)} kg · ${unit.volumePerUnitM3.toLocaleString(localeTag)} m³`).join(" / ")],
    [t("Equipo requerido", "Required equipment"), request.requiredEquipment ?? t("No especificado", "Not specified")],
    [t("Requisitos declarados", "Declared requirements"), cargo.requirements.join(" · ") || t("Sin requisitos adicionales declarados", "No additional requirements declared")],
    ...(cargo.temperatureRange ? [[t("Temperatura declarada", "Declared temperature"), `${cargo.temperatureRange.minCelsius} – ${cargo.temperatureRange.maxCelsius} °C`]] : []),
  ];
  return <details className={`${styles.panel} ${operations.factsDisclosure}`}><summary className={styles.panelHeader}>{t("Datos de la solicitud", "Request details")}<ChevronDown size={17} aria-hidden="true"/></summary>
    <div className={styles.section}><dl className={operations.facts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
  </details>;
}
