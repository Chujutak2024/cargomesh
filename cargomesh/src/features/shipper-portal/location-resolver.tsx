"use client";

import { CheckCircle2, Loader2, MapPin, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import type { FreightLocationV2 } from "@/features/v2-intake/contracts";
import { useLocale } from "@/features/i18n/locale-provider";
import { confirmLocation, resolveLocation, ShipperApiError } from "./shipper-api";
import styles from "./shipper-portal.module.css";

type Candidate = Awaited<ReturnType<typeof resolveLocation>>["candidates"][number];

export function LocationResolver({ label, onConfirmed }: { label: string; onConfirmed: (location: FreightLocationV2) => void }) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "no-match" | "ambiguous" | "confirmed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setStatus("loading"); setError(null); setCandidates([]);
    try {
      const result = await resolveLocation({ kind: "TEXT", text: query.trim() });
      setCandidates(result.candidates); setStatus(result.status === "NO_MATCH" ? "no-match" : "ambiguous");
    } catch (caught) { setStatus("idle"); setError(caught instanceof ShipperApiError ? `${caught.code}: ${caught.message}` : String(caught)); }
  }
  async function choose(candidate: Candidate) {
    setStatus("loading"); setError(null);
    try {
      const result = await confirmLocation({ query: { kind: "TEXT", text: query.trim() }, candidateId: candidate.id,
        candidateKind: candidate.kind, expectedVersion: candidate.version, confirmed: true });
      onConfirmed(result.location); setStatus("confirmed"); setCandidates([]);
    } catch (caught) { setStatus("ambiguous"); setError(caught instanceof ShipperApiError ? `${caught.code}: ${caught.message}` : String(caught)); }
  }
  return <section className={styles.resolver} aria-label={label}><div className={styles.resolverSearch}><Input label={label} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Buscar sede o nodo persistido", "Search persisted facility or node")}/><Button variant="secondary" disabled={query.trim().length < 2} isLoading={status === "loading"} onClick={() => void search()}><Search size={15}/>{t("Buscar", "Search")}</Button></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {status === "no-match" ? <p className={styles.notice} data-tone="warning"><MapPin size={15}/>{t("Cero resultados. El backend actual no usa geocodificador externo; puedes mantener una referencia manual y confirmarla antes de guardar.", "Zero results. The current backend does not use an external geocoder; you may keep a manual reference and confirm it before saving.")}</p> : null}
    {candidates.length ? <div className={styles.resolverResults}>{candidates.map((candidate) => <button type="button" key={`${candidate.kind}-${candidate.id}`} onClick={() => void choose(candidate)}><MapPin size={15}/><span><strong>{candidate.location.label}</strong><small>{candidate.kind} · {candidate.location.city}, {candidate.location.countryCode} · {candidate.source.provenanceStatus}</small></span><ShieldCheck size={15}/></button>)}</div> : null}
    {status === "confirmed" ? <p className={styles.notice}><CheckCircle2 size={15}/>{t("Lugar confirmado contra la versión vigente del catálogo.", "Location confirmed against the current catalog version.")}</p> : null}
    {status === "loading" ? <span className={styles.srOnly}><Loader2/> {t("Buscando", "Searching")}</span> : null}
  </section>;
}
