"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type { FreightRequestListItem, FreightRequestStatus } from "@/features/freight-ui/view-models";
import { useLocale } from "@/features/i18n/locale-provider";
import { RequestTable } from "./request-table";
import styles from "./request-directory.module.css";

const FILTERS: Array<"ALL" | FreightRequestStatus> = ["ALL", "DRAFT", "ORCHESTRATING", "AWAITING_SELECTION", "BOOKING", "BOOKED", "IN_TRANSIT", "COMPLETED", "FAILED", "CANCELLED"];

export function RequestDirectory({ requests, initialQuery = "" }: { requests: FreightRequestListItem[]; initialQuery?: string }) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("ALL");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return requests.filter((request) =>
      (status === "ALL" || request.status === status) &&
      (!needle || [request.requestCode, request.origin, request.destination, request.cargoDetail]
        .some((value) => value.toLocaleLowerCase().includes(needle))),
    );
  }, [query, requests, status]);

  return (
    <section className={styles.directory}>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <span className={styles.srOnly}>{t("Buscar cargas", "Search shipments")}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Código, origen o destino", "Code, origin, or destination")} />
        </label>
        <label className={styles.filter}>
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span className={styles.srOnly}>{t("Filtrar por estado", "Filter by status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as (typeof FILTERS)[number])}>
            {FILTERS.map((value) => <option key={value} value={value}>{value === "ALL" ? t("Todos los estados", "All statuses") : value}</option>)}
          </select>
        </label>
        <span className={styles.count}>{visible.length} {t("resultados", "results")}</span>
      </div>
      <RequestTable requests={visible} locale={locale} />
    </section>
  );
}
