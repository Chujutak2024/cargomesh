"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CARRIER_TOWER } from "@/features/carrier-navigation/workspace-route";
import { facilities, cityLabel } from "@/features/v2-workspace/road-locations";
import type { RoadCalculation, RouteQuery } from "./contract";
import { RouteMap } from "./route-map";
import s from "./route-lab.module.css";

const cases = [
  ["Peru · coast", "lima", "arequipa"], ["Peru · mountains", "lima", "huancayo"],
  ["Chile → Argentina", "cl-santiago", "buenos-aires"], ["Spain", "madrid", "barcelona"],
  ["United States", "los-angeles", "las-vegas"], ["Road gap · Colombia → US", "bogota", "houston"],
] as const;
const emptyRoutes: [] = [];
const failures: Record<string, string> = {
  SERVER_KEY_MISSING: "Road calculation is not configured: the server Routes API credential is missing. No route has been invented.",
  DISCONNECTED_NETWORKS: "These city references belong to disconnected road networks. Choose a road-connected pair.",
  NO_ROUTE: "Google returned no route for this pair. Road access remains unconfirmed.",
  NO_VALID_ROAD_ROUTE: "No complete road-only alternative passed validation. No replacement line is drawn.",
  PROVIDER_DENIED: "Google denied the routing request. Check the server API configuration.",
  PROVIDER_UNAVAILABLE: "Google Routes could not complete the calculation. Try again later.",
  RATE_LIMITED: "The local calculation budget has been reached. Wait a minute before retrying.",
  INVALID_ROUTE: "Choose two different supported city references.",
  NOT_AVAILABLE: "The local routing lab is disabled or its local origin is not configured.",
};

export function RouteLab() {
  useEffect(()=>{document.querySelector<HTMLElement>('#coordinator-content h1')?.focus({preventScroll:true});},[]);
  const [query, setQuery] = useState<RouteQuery>({ originId: "lima", destinationId: "arequipa", objective: "FASTEST", traffic: "TRAFFIC_AWARE_OPTIMAL" });
  const [result, setResult] = useState<RoadCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; request.current?.abort(); }, []);
  const change = (next: RouteQuery) => {
    revision.current++; request.current?.abort(); setQuery(next); setResult(null); setSelectedId(null); setLoading(false); setMessage("");
  };
  async function calculate(event: FormEvent) {
    event.preventDefault(); request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const current = ++revision.current; setResult(null); setSelectedId(null); setMessage(""); setLoading(true);
    try {
      const response = await fetch("/api/local/route-lab", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query), signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (controller.signal.aborted || current !== revision.current) return;
      if (response.ok && data.status === "estimated" && data.source === "GOOGLE_ROUTES_API") {
        setResult(data); setSelectedId(data.selectedId);
      } else setMessage(failures[data.reason] ?? "Calculation unavailable. No geometry is displayed.");
    } catch { if (!controller.signal.aborted && current === revision.current) setMessage("Calculation unavailable. No geometry is displayed."); }
    finally { if (current === revision.current) setLoading(false); }
  }
  const alternatives = result?.status === "estimated" ? result.alternatives : emptyRoutes;
  return <main id="coordinator-content" className={s.shell}>
    <header className={s.header}><div><a href={CARRIER_TOWER}>← Control tower</a><h1 tabIndex={-1}>Road routing lab</h1><p>Compare calculated city-to-city routes before connecting vehicle movement.</p></div><span className={s.badge}>LOCAL PREVIEW</span></header>
    <p className={s.notice}>City references are sample inputs. Routes are driving estimates from Google, not verified truck access, carrier coverage or live GPS.</p>
    <div className={s.cases} aria-label="City scenarios">{cases.map(([label, originId, destinationId]) => <button key={label} type="button" onClick={() => change({ ...query, originId, destinationId })}>{label}</button>)}</div>
    <form className={s.form} onSubmit={calculate}>
      {(["originId", "destinationId"] as const).map(field => <label key={field}>{field === "originId" ? "Origin city" : "Destination city"}<select value={query[field]} onChange={e => change({ ...query, [field]: e.target.value })}>{facilities.map(location => <option key={location.id} value={location.id}>{cityLabel(location, "en")} · {location.countryCode}</option>)}</select></label>)}
      <label>Selection objective<select value={query.objective} onChange={e => change({ ...query, objective: e.target.value as RouteQuery["objective"] })}><option value="FASTEST">Lowest travel time</option><option value="SHORTEST_RETURNED">Lowest distance among returned routes</option></select></label>
      <label>Traffic model<select value={query.traffic} onChange={e => change({ ...query, traffic: e.target.value as RouteQuery["traffic"] })}><option value="TRAFFIC_AWARE_OPTIMAL">Traffic aware · thorough search</option><option value="TRAFFIC_UNAWARE">Traffic unaware · baseline</option></select></label>
      <button type="submit" disabled={loading}>{loading ? "Calculating…" : "Calculate road routes"}</button>
    </form>
    <div role="status" aria-live="polite" className={s.status}>{loading ? "Requesting road alternatives from Google…" : message}</div>
    <RouteMap alternatives={alternatives} selectedId={selectedId} />
    {result?.status === "estimated" && <section className={s.results} aria-labelledby="route-results"><h2 id="route-results">Calculated alternatives</h2><p>Selected by {result.objective === "FASTEST" ? "travel time, then distance" : "distance, then travel time"}. Best among {alternatives.length} accepted alternatives returned by Google; the complete road network is not evaluated by CargoMesh.</p><p>Google Maps · {result.traffic} · Calculated {result.calculatedAt} · Truck access unverified</p>
      <div className={s.cards}>{alternatives.map(route => <article key={route.id}><button type="button" aria-pressed={selectedId === route.id} onClick={() => setSelectedId(route.id)}>View route {route.providerIndex + 1}{result.selectedId === route.id ? " · Recommended" : ""}</button><strong>{(route.distanceMeters / 1000).toFixed(1)} km · {Math.round(route.durationSeconds / 60)} min</strong><span>{route.points.length.toLocaleString("en")} provider geometry points</span>{route.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</article>)}</div>
      {result.rejected.length > 0 && <details><summary>{result.rejected.length} alternatives rejected</summary><ul>{result.rejected.map(item => <li key={item.providerIndex}>Route {item.providerIndex + 1}: {item.reason}</li>)}</ul></details>}
    </section>}
    <footer className={s.footer}>No invented road segments. No operational writes. No permanent storage of Google route geometry.</footer>
  </main>;
}
