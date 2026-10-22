import type { MapPresentation } from "./road-map-model";
import { mapFailureLabel, schematicMapModel, type MapFailure } from "./schematic-map-model";
import styles from "./schematic-map.module.css";

export function SchematicMapView({ presentation, failure, locale = "en", onRetry }: {
  presentation: MapPresentation; failure: MapFailure; locale?: "en" | "es"; onRetry?: () => void;
}) {
  const model = schematicMapModel(presentation), es = locale === "es";
  return <section className={styles.root} aria-label={es ? "Vista esquemática de esta operación" : "Schematic view of this operation"}>
    <strong>{es ? "Vista esquemática · Google Maps no disponible · no es mapa vial ni GPS"
      : "Schematic view · Google Maps unavailable · not a road map, not GPS"}</strong>
    <p role="status">{mapFailureLabel(failure, locale)}</p>
    {model ? <>
      <svg className={styles.diagram} viewBox="0 0 800 300" role="img" aria-label={es ? "Solo extremos y tramos declarados de esta operación" : "Only this operation's endpoints and declared legs"}>
        {model.paths.map((path, index) => <polyline key={index} points={path.points} fill="none" strokeWidth="4"
          className={styles.path} data-provenance={path.provenance} />)}
        {model.connection ? <polyline points={model.connection} fill="none" strokeWidth="3" strokeDasharray="8 7" className={styles.connection}/> : null}
        {model.markers.map(marker => <g key={marker.kind}>
          <circle cx={marker.x} cy={marker.y} r="11" className={styles.marker}/>
          <text x={marker.x} y={marker.y + (marker.kind === "origin" ? -20 : 33)} textAnchor="middle">{marker.kind === "origin" ? "A" : "B"}</text>
        </g>)}
      </svg>
      <dl className={styles.endpoints}>{model.markers.map(marker => <div key={marker.kind}>
        <dt>{marker.kind === "origin" ? (es ? "A · Origen" : "A · Origin") : (es ? "B · Destino" : "B · Destination")}</dt><dd>{marker.label}</dd>
      </div>)}</dl>
      {model.connection ? <p className={styles.notice}>{es ? "Conexión esquemática — no es una ruta vial verificada" : "Schematic connection — not a verified road route"}</p> : null}
      {model.paths.length ? <ul className={styles.legs}>{model.paths.map((path, index) => <li key={index} data-provenance={path.provenance}>
        {es ? "Tramo" : "Leg"} {path.sequence}: <strong>{path.provenance}</strong>
      </li>)}</ul> : null}
    </> : <p>{es ? "Sin coordenadas de esta operación; no se dibuja una ruta." : "No coordinates for this operation; no route is drawn."}</p>}
    {onRetry ? <button type="button" className={styles.retry} onClick={onRetry}>{es ? "Reintentar mapa" : "Retry map"}</button> : null}
  </section>;
}
