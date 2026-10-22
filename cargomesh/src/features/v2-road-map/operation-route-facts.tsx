import React from "react";
import type { Locale } from "@/features/i18n/config";
import type { OperationRouteFacts, PublicMapSource } from "./operation-route-model";
import { formatOperationDuration, formatOperationInstant, type OperationMapTranslate } from "./operation-route-format";
import styles from "./schematic-map.module.css";

type LocaleProps = { locale: Locale; t: OperationMapTranslate };
function Evidence({ value, locale, t }: { value: PublicMapSource } & LocaleProps) {
  return <p className={styles.metadata}>{value.provider} · <code>{value.reference}</code> · {value.provenance}<br/>
    {t("Observado", "Observed")}: {formatOperationInstant(value.observedAt, locale)} · {t("Válido hasta", "Valid until")}: {formatOperationInstant(value.validUntil, locale)}</p>;
}

/** Tracking supplies its locale and translator; these remain three independent facts. */
export function OperationRouteFactsView({ facts, locale, t }: { facts: OperationRouteFacts } & LocaleProps) {
  const { geometry, commercial, eta } = facts;
  const duration = (seconds: number | null) => formatOperationDuration(seconds, locale, t);
  const instant = (value: string | null) => formatOperationInstant(value, locale);
  const labels = { geometry: t("Geometría mostrada", "Displayed geometry"), corridor: t("Corredor comercial contratado", "Contracted commercial corridor"),
    eta: t("Estimación de entrega al cotizar", "Delivery estimate at quote time") };
  return <div className={styles.facts} aria-label={t("Ruta, corredor contratado y ETA al cotizar", "Route, contracted corridor and quote-time ETA")}>
    <section aria-label={labels.geometry}>
      <h3>{labels.geometry}</h3>
      <p>{t("Ruta", "Route")} <code>{geometry.routeId}</code> · v{geometry.version} · {geometry.provenance}</p>
      <dl><div><dt>{t("Fuente de geometría", "Geometry source")}</dt><dd>{geometry.source ?? t("No informada", "Not supplied")}</dd></div>
        <div><dt>{t("Distancia declarada", "Declared distance")}</dt><dd>{geometry.distanceKm === null ? t("No informada", "Not supplied") : geometry.distanceKm + " km"}</dd></div>
        <div><dt>{t("Duración declarada de la ruta", "Declared route duration")}</dt><dd>{duration(geometry.durationSeconds)}</dd></div></dl>
      {geometry.evidence.map((value, index) => <Evidence key={index} value={value} locale={locale} t={t}/>)}
      {!geometry.evidence.length ? <p>{t("La vigencia de la geometría no está informada en el DTO de ruta.", "Geometry validity not supplied in the route DTO.")}</p> : null}
    </section>
    <section aria-label={labels.corridor}>
      <h3>{labels.corridor}</h3>
      <p>{t("Oferta contratada", "Booked offer")} <code>{commercial.offerId}</code> · {t("oferta", "offer")} v{commercial.offerVersion} / {t("registro", "record")} v{commercial.offerRecordVersion}<br/>
        {t("Plan", "Plan")} <code>{commercial.planId}</code> · v{commercial.planVersion} · {t("servicio", "service")} <code>{commercial.serviceId}</code></p>
      <dl><div><dt>{t("Tránsito comercial", "Commercial transit")}</dt><dd>{duration(commercial.transitSeconds)}</dd></div>
        <div><dt>{t("Ventana operativa contratada", "Booked operation window")}</dt><dd>{duration(commercial.windowSeconds)}</dd></div></dl>
      <p>{instant(commercial.window.startsAt)} – {instant(commercial.window.endsAt)}</p>
      <Evidence value={commercial.source} locale={locale} t={t}/>
      {commercial.corridors.map((corridor, index) => <div key={index}>
        <p>{t("Corredor", "Corridor")} <code>{corridor.id}</code> · {t("versión contratada", "booked")} v{corridor.version}</p>
        <dl><div><dt>{t("Distancia del corredor", "Corridor distance")}</dt><dd>{corridor.distanceKm === null ? t("No informada", "Not supplied") : corridor.distanceKm + " km"}</dd></div>
          <div><dt>{t("Duración declarada del corredor", "Declared corridor duration")}</dt><dd>{duration(corridor.declaredDurationSeconds)}</dd></div>
          <div><dt>{t("Tiempo de conducción declarado", "Declared driving time")}</dt><dd>{corridor.drivingSeconds === null ? t("No disponible", "Unavailable") : duration(corridor.drivingSeconds)}</dd></div></dl>
        <Evidence value={corridor.source} locale={locale} t={t}/>
        {corridor.drivingSource ? <Evidence value={corridor.drivingSource} locale={locale} t={t}/> : <p className={styles.gap}>{t("El tiempo de conducción no está disponible para esta versión del corredor contratado.", "Driving time is unavailable for this booked corridor revision.")}</p>}
      </div>)}
      <p className={styles.gap}>{t("El DTO de Client no informa el tiempo pagado ni la versión del servicio. La ventana operativa no acredita tiempo pagado.", "Paid time and service revision are not supplied in the Client booked DTO. The operation window does not establish paid time.")}</p>
    </section>
    <section aria-label={labels.eta}>
      <h3>{labels.eta}</h3>
      <p>{instant(eta.at)} · {t("no es una ETA en vivo ni una confirmación de llegada.", "not a live ETA or an arrival confirmation.")}</p>
      <p>{t("Oferta", "Offer")} <code>{eta.offerId}</code> · v{eta.offerVersion} · {t("emitida", "issued")} {instant(eta.issuedAt)}<br/>
        {t("Vigencia de la cotización", "Quote validity")}: {instant(eta.validity.startsAt)} – {instant(eta.validity.endsAt)}</p>
      <Evidence value={eta.source} locale={locale} t={t}/>
    </section>
  </div>;
}
