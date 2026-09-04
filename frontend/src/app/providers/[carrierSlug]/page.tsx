import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { localeTag, translate } from "@/features/i18n/config";
import { getRequestLocale } from "@/features/i18n/server";
import { getProviderPageConfig } from "@/features/providers/get-provider-page-config";
import {
  getProviderServiceId,
  type ProviderSearchParams,
} from "@/features/providers/provider-route-params";

import { ProviderWebMcpHost } from "./provider-webmcp-host";
import styles from "./provider.module.css";

export const dynamic = "force-dynamic";

type ProviderPageProps = {
  params: Promise<{ carrierSlug: string }>;
  searchParams: Promise<ProviderSearchParams>;
};

export async function generateMetadata({
  params,
  searchParams,
}: ProviderPageProps): Promise<Metadata> {
  const [{ carrierSlug }, resolvedSearchParams, locale] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
  ]);
  const serviceId = getProviderServiceId(resolvedSearchParams);
  const provider = await getProviderPageConfig(carrierSlug, serviceId);

  if (!provider) {
    return { title: `${translate(locale, "Provider no encontrado", "Provider not found")} | CargoMesh` };
  }

  return {
    title: `${provider.displayName} | CargoMesh Provider`,
    description: translate(
      locale,
      `Portal WebMCP del transportista registrado ${provider.displayName}.`,
      `WebMCP portal for the registered carrier ${provider.displayName}.`,
    ),
  };
}

export default async function ProviderPage({ params, searchParams }: ProviderPageProps) {
  const [{ carrierSlug }, resolvedSearchParams, locale] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
  ]);
  const serviceId = getProviderServiceId(resolvedSearchParams);
  const provider = await getProviderPageConfig(carrierSlug, serviceId);

  if (!provider) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--muted)", textDecoration: "none", fontSize: "0.82rem", fontWeight: 600 }}>
          ← {translate(locale, "Volver al Control Tower", "Return to Control Tower")}
        </Link>
      </div>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Registered WebMCP provider</p>
          <h1>{provider.displayName}</h1>
          <p className={styles.code}>{provider.carrierCode}</p>
        </div>
        <span className={styles.badge}>ACTIVE</span>
      </header>

      <section className={styles.grid} aria-label={translate(locale, "Capacidades del transportista", "Carrier capabilities")}>
        <article>
          <span>{translate(locale, "Modalidad", "Mode")}</span>
          <strong>{provider.service.transportMode}</strong>
        </article>
        <article>
          <span>{translate(locale, "Servicio", "Service")}</span>
          <strong>{provider.service.serviceType}</strong>
        </article>
        <article>
          <span>{translate(locale, "Capacidad máxima", "Maximum capacity")}</span>
          <strong>{provider.service.maxCapacityKg.toLocaleString(localeTag(locale))} kg</strong>
        </article>
        <article>
          <span>Cross-border</span>
          <strong>{provider.service.supportsCrossBorder
            ? translate(locale, "Disponible", "Available")
            : translate(locale, "No disponible", "Unavailable")}</strong>
        </article>
      </section>

      <ProviderWebMcpHost provider={provider} />

      <footer className={styles.footer}>
        <span>Provider URL</span>
        <code>{provider.providerUrl}</code>
      </footer>
    </main>
  );
}
