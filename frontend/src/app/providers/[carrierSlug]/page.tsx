import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  const [{ carrierSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const serviceId = getProviderServiceId(resolvedSearchParams);
  const provider = serviceId
    ? await getProviderPageConfig(carrierSlug, serviceId)
    : null;

  if (!provider) {
    return { title: "Provider no encontrado | CargoMesh" };
  }

  return {
    title: `${provider.displayName} | CargoMesh Provider`,
    description: `Portal WebMCP del transportista registrado ${provider.displayName}.`,
  };
}

export default async function ProviderPage({ params, searchParams }: ProviderPageProps) {
  const [{ carrierSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const serviceId = getProviderServiceId(resolvedSearchParams);

  if (!serviceId) {
    notFound();
  }

  const provider = await getProviderPageConfig(carrierSlug, serviceId);

  if (!provider) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Registered WebMCP provider</p>
          <h1>{provider.displayName}</h1>
          <p className={styles.code}>{provider.carrierCode}</p>
        </div>
        <span className={styles.badge}>ACTIVE</span>
      </header>

      <section className={styles.grid} aria-label="Capacidades del transportista">
        <article>
          <span>Modalidad</span>
          <strong>{provider.service.transportMode}</strong>
        </article>
        <article>
          <span>Servicio</span>
          <strong>{provider.service.serviceType}</strong>
        </article>
        <article>
          <span>Capacidad máxima</span>
          <strong>{provider.service.maxCapacityKg.toLocaleString("es-PE")} kg</strong>
        </article>
        <article>
          <span>Cross-border</span>
          <strong>{provider.service.supportsCrossBorder ? "Disponible" : "No disponible"}</strong>
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
