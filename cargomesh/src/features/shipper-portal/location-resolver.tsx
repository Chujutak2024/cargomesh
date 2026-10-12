"use client";

import { CheckCircle2, MapPin, Search, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import type { FreightLocationV2 } from "@/features/v2-intake/contracts";
import { useLocale } from "@/features/i18n/locale-provider";
import { confirmLocation, resolveLocation, ShipperApiError } from "./shipper-api";
import { LocationPinPicker } from "./location-pin-picker";
import styles from "./shipper-portal.module.css";

type Candidate = Awaited<ReturnType<typeof resolveLocation>>["candidates"][number];
type LocationQuery = Parameters<typeof resolveLocation>[0];
type Phase = "idle" | "searching" | "results" | "no-match" | "confirming" | "confirmed";

export function LocationResolver({ label, onConfirmed, onProposedCoordinates }: {
  label: string;
  onConfirmed: (location: FreightLocationV2) => void;
  onProposedCoordinates: (lat: number, lng: number) => void;
}) {
  const { t } = useLocale();
  const [mode, setMode] = useState<"text" | "coordinates">("text");
  const [query, setQuery] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [usedQuery, setUsedQuery] = useState<LocationQuery | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const searchSerial = useRef(0);

  function invalidate() {
    searchSerial.current += 1;
    setCandidates([]);
    setUsedQuery(null);
    setPhase("idle");
    setError(null);
  }
  function validCoordinates(): { lat: number; lng: number } | null {
    if (!lat.trim() || !lng.trim()) return null;
    const a = Number(lat), b = Number(lng);
    return Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180
      ? { lat: a, lng: b } : null;
  }
  function coordinatePicked(a: number, b: number) {
    invalidate();
    const roundedLat = Number(a.toFixed(6));
    const roundedLng = Number(b.toFixed(6));
    setLat(String(roundedLat));
    setLng(String(roundedLng));
    onProposedCoordinates(roundedLat, roundedLng);
  }
  async function search() {
    const position = mode === "coordinates" ? validCoordinates() : null;
    if (mode === "coordinates" && !position) {
      setError(t("Latitud y longitud deben ser válidas.", "Enter valid latitude and longitude."));
      return;
    }
    if (mode === "text" && query.trim().length < 2) return;
    const typedQuery: LocationQuery = mode === "text"
      ? { kind: "TEXT", text: query.trim() }
      : { kind: "COORDINATES", ...position!, radiusMeters: 50 };
    const serial = ++searchSerial.current;
    setUsedQuery(null); setCandidates([]); setError(null); setPhase("searching");
    try {
      const result = await resolveLocation(typedQuery);
      if (serial !== searchSerial.current) return;
      setCandidates(result.candidates);
      setUsedQuery(typedQuery);
      setTruncated(result.truncated);
      setPhase(result.candidates.length ? "results" : "no-match");
    } catch (caught) {
      if (serial !== searchSerial.current) return;
      const detail = caught instanceof ShipperApiError ? `${caught.code}: ${caught.message}` : String(caught);
      setError(detail); setPhase("idle");
    }
  }
  async function choose(candidate: Candidate) {
    if (!usedQuery) return;
    const activeQuery = usedQuery;
    const serial = ++searchSerial.current;
    setPhase("confirming"); setError(null);
    try {
      const confirmed = await confirmLocation({
        query: activeQuery, candidateId: candidate.id, candidateKind: candidate.kind,
        expectedVersion: candidate.version, confirmed: true,
      });
      if (serial !== searchSerial.current) return;
      onConfirmed(confirmed.location);
      setCandidates([]); setUsedQuery(null); setPhase("confirmed");
    } catch (caught) {
      if (serial !== searchSerial.current) return;
      const detail = caught instanceof ShipperApiError ? `${caught.code}: ${caught.message}` : String(caught);
      setError(detail);
      setPhase("results");
      // The 409 candidate is stale; force a new resolution before confirming again.
      if (caught instanceof ShipperApiError && caught.status === 409) {
        setCandidates([]); setUsedQuery(null);
      }
    }
  }
  const coords = validCoordinates();
  const busy = phase === "searching" || phase === "confirming";

  return <section className={styles.resolver} aria-label={label}>
    <strong>{label}</strong>
    <div className={styles.locationModes} role="group" aria-label={t("Tipo de búsqueda", "Search type")}>
      <Button type="button" variant={mode === "text" ? "primary" : "secondary"} onClick={() => { setMode("text"); invalidate(); }}>
        {t("Nombre o ciudad", "Name or city")}
      </Button>
      <Button type="button" variant={mode === "coordinates" ? "primary" : "secondary"} onClick={() => { setMode("coordinates"); invalidate(); }}>
        {t("Coordenadas o pin", "Coordinates or pin")}
      </Button>
    </div>
    {mode === "text" ? <div className={styles.resolverSearch}>
      <Input label={t("Buscar sede o nodo registrado", "Search registered facility or node")} value={query}
        onChange={(event) => { setQuery(event.target.value); invalidate(); }}
        placeholder={t("Código, sede o ciudad", "Code, facility or city")} />
      <Button type="button" variant="secondary" disabled={busy || query.trim().length < 2} onClick={() => void search()}>
        <Search size={15} aria-hidden="true" />{t("Buscar", "Search")}
      </Button>
    </div> : <>
      <div className={styles.locationCoordinateGrid}>
        <Input label={t("Latitud", "Latitude")} type="number" min={-90} max={90} step="any" value={lat}
          onChange={(event) => { setLat(event.target.value); invalidate(); }} placeholder="-12.0464" />
        <Input label={t("Longitud", "Longitude")} type="number" min={-180} max={180} step="any" value={lng}
          onChange={(event) => { setLng(event.target.value); invalidate(); }} placeholder="-77.0428" />
      </div>
      <div className={styles.locationModes}>
        <Button type="button" variant="secondary" onClick={() => setMapOpen(value => !value)}>
          <MapPin size={15} aria-hidden="true" />{mapOpen ? t("Cerrar mapa", "Close map") : t("Marcar en mapa", "Pick on map")}
        </Button>
        <Button type="button" variant="secondary" disabled={!coords || busy} onClick={() => coords && onProposedCoordinates(coords.lat, coords.lng)}>
          {t("Usar punto propuesto", "Use proposed point")}
        </Button>
        <Button type="button" disabled={!coords || busy} onClick={() => void search()}>
          <Search size={15} aria-hidden="true" />{t("Buscar coincidencias", "Find matches")}
        </Button>
      </div>
      {mapOpen ? <LocationPinPicker lat={coords?.lat ?? null} lng={coords?.lng ?? null} onPick={coordinatePicked} /> : null}
      <p className={styles.locationNote}>{t(
        "Las coordenadas buscan coincidencias entre sedes/nodos registrados (radio 50 m). Si no hay coincidencias, el punto sigue siendo manual: revisa ciudad, país y referencia antes de confirmarlo en el formulario.",
        "Coordinates search registered facilities/nodes within 50 m. If no match is found, the point remains manual: review city, country and reference before confirming in the form.",
      )}</p>
    </>}
    {error ? <p className={styles.locationError} role="alert">{error}</p> : null}
    {phase === "no-match" ? <p className={styles.locationNote} role="status">{t(
      "Sin coincidencias registradas. No hay búsqueda externa de direcciones disponible. Puedes introducir una referencia manual y confirmarla, sin atribuirle precisión verificada.",
      "No registered matches. External address geocoding is unavailable. You may enter and explicitly confirm a manual reference without claiming verified accuracy.",
    )}</p> : null}
    {truncated && candidates.length ? <p className={styles.locationNote}>{t("Se muestran como máximo 50 coincidencias. Acota tu búsqueda.", "At most 50 matches are shown. Narrow your search.")}</p> : null}
    {candidates.length > 0 ? <div className={styles.resolverResults} role="group" aria-label={t("Ubicaciones candidatas", "Candidate locations")}>
      {candidates.map((candidate) => <button type="button" key={`${candidate.kind}-${candidate.id}`} disabled={busy}
        onClick={() => void choose(candidate)}>
        <MapPin size={16} aria-hidden="true" />
        <span><strong>{candidate.location.label}</strong>
          <small>{candidate.kind} · {[candidate.location.city, candidate.location.region, candidate.location.countryCode].filter(Boolean).join(" · ")}</small>
          <small>{t("Procedencia", "Provenance")}: {candidate.source.provenanceStatus} · {t("Versión", "Version")} {candidate.version}</small>
          <small>{candidate.location.lat == null || candidate.location.lng == null
            ? t("Coordenadas desconocidas; precisión no documentada", "Unknown coordinates; accuracy not documented")
            : `${candidate.location.lat.toFixed(6)}, ${candidate.location.lng.toFixed(6)} · ${t("Precisión no informada", "Accuracy not provided")}`}</small>
        </span><span className={styles.confirmLocation}><ShieldCheck size={15} aria-hidden="true" />{t("Confirmar", "Confirm")}</span>
      </button>)}
    </div> : null}
    {busy ? <p role="status" className={styles.locationNote}>{t("Consultando o confirmando…", "Searching or confirming…")}</p> : null}
    {phase === "confirmed" ? <p className={styles.locationNote} role="status"><CheckCircle2 size={15} aria-hidden="true" /> {t("Ubicación persistida confirmada por el servidor.", "Persisted location confirmed by the server.")}</p> : null}
    <p className={styles.locationNote}>{t(
      "Esta búsqueda usa sólo ubicaciones persistidas de CargoMesh. No verifica direcciones externas, GPS ni cobertura.",
      "This lookup uses persisted CargoMesh locations only. It does not verify external addresses, GPS or coverage.",
    )}</p>
  </section>;
}
