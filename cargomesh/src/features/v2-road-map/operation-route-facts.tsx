import type { OperationRouteFacts, PublicMapSource } from "./operation-route-model";
import styles from "./schematic-map.module.css";

function duration(seconds: number | null) { return seconds === null ? "Not supplied" : `${seconds / 3600} h (${seconds / 60} min)`; }
function Evidence({ value }: { value: PublicMapSource }) {
  return <p className={styles.metadata}>{value.provider} · <code>{value.reference}</code> · {value.provenance}<br/>
    Observed: {value.observedAt} · Valid until: {value.validUntil ?? "Not supplied"}</p>;
}

/** These three sections are separate facts, not interchangeable distances or live ETAs. */
export function OperationRouteFactsView({ facts }: { facts: OperationRouteFacts }) {
  const { geometry, commercial, eta } = facts;
  return <div className={styles.facts} aria-label="Route, contracted corridor and quote-time ETA">
    <section aria-label="Displayed geometry">
      <h3>Displayed geometry</h3>
      <p>Route <code>{geometry.routeId}</code> · v{geometry.version} · {geometry.provenance}</p>
      <dl><div><dt>Geometry source</dt><dd>{geometry.source ?? "Not supplied"}</dd></div>
        <div><dt>Declared distance</dt><dd>{geometry.distanceKm === null ? "Not supplied" : `${geometry.distanceKm} km`}</dd></div>
        <div><dt>Declared route duration</dt><dd>{duration(geometry.durationSeconds)}</dd></div></dl>
      {geometry.evidence.map((value, index) => <Evidence key={index} value={value}/>)}
      {!geometry.evidence.length ? <p>Geometry validity not supplied in the route DTO.</p> : null}
    </section>
    <section aria-label="Contracted commercial corridor">
      <h3>Contracted commercial corridor</h3>
      <p>Booked offer <code>{commercial.offerId}</code> · offer v{commercial.offerVersion} / record v{commercial.offerRecordVersion}<br/>
        Plan <code>{commercial.planId}</code> · v{commercial.planVersion} · service <code>{commercial.serviceId}</code></p>
      <dl><div><dt>Commercial transit</dt><dd>{duration(commercial.transitSeconds)}</dd></div>
        <div><dt>Booked operation window</dt><dd>{duration(commercial.windowSeconds)}</dd></div></dl>
      <p>{commercial.window.startsAt} – {commercial.window.endsAt}</p>
      <Evidence value={commercial.source}/>
      {commercial.corridors.map((corridor, index) => <div key={index}>
        <p>Corridor <code>{corridor.id}</code> · booked v{corridor.version}</p>
        <dl><div><dt>Corridor distance</dt><dd>{corridor.distanceKm === null ? "Not supplied" : `${corridor.distanceKm} km`}</dd></div>
          <div><dt>Declared corridor duration</dt><dd>{duration(corridor.declaredDurationSeconds)}</dd></div>
          <div><dt>Declared driving time</dt><dd>{duration(corridor.drivingSeconds)}</dd></div></dl>
        <Evidence value={corridor.source}/>
        {corridor.drivingSource ? <Evidence value={corridor.drivingSource}/> : <p className={styles.gap}>Driving time is unavailable for this booked corridor revision.</p>}
      </div>)}
      <p className={styles.gap}>Paid time and service revision are not supplied in the Client booked DTO. The operation window does not establish paid time.</p>
    </section>
    <section aria-label="Delivery estimate at quote time">
      <h3>Delivery estimate at quote time</h3>
      <p>{eta.at ?? "Not supplied"} · not a live ETA or an arrival confirmation.</p>
      <p>Offer <code>{eta.offerId}</code> · v{eta.offerVersion} · issued {eta.issuedAt}<br/>
        Quote validity: {eta.validity.startsAt} – {eta.validity.endsAt}</p>
      <Evidence value={eta.source}/>
    </section>
  </div>;
}
