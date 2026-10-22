import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { getRequestLocale } from "@/server/i18n/server";
import { translate } from "@/features/i18n/config";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export default async function ClientNotFound() {
  const locale = await getRequestLocale();
  const t = (es: string, en: string) => translate(locale, es, en);
  return <section className={styles.page}>
    <header className={styles.hero}><div className={styles.heroCopy}>
      <SearchX size={26} aria-hidden="true" />
      <h1>{t("No encontramos este registro", "We could not find this record")}</h1>
      <p>{t("Revisa el enlace o vuelve a tus cargas para consultar los registros disponibles en tu espacio.", "Check the link or return to your shipments to view the records available in your workspace.")}</p>
    </div></header>
    <div><Link className={styles.secondary} href="/clients/requests"><ArrowLeft size={16} aria-hidden="true" />{t("Volver a mis cargas", "Back to my shipments")}</Link></div>
  </section>;
}
