import { DemoLogin } from "@/components/demo-login";
import { redirectAuthenticatedMemberFromLogin } from "@/features/auth/route-guard";
import { LanguageSwitcher } from "@/components/language-switcher";
import { loginCopy } from "@/features/auth/login-copy";
import { getRequestLocale } from "@/features/i18n/server";
import { Activity, Boxes, Network, Route, ShieldCheck } from "lucide-react";
import styles from "./page.module.css";

export default async function LoginPage() {
  await redirectAuthenticatedMemberFromLogin();

  const locale = await getRequestLocale();
  const copy = loginCopy[locale];

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-labelledby="login-brand-title">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Network size={22} strokeWidth={1.8} />
          </span>
          <span>
            <strong>{copy.brand.name}</strong>
            <small>{copy.brand.label}</small>
          </span>
        </div>
        <div className={styles.brandCopy}>
          <span className={styles.eyebrow}>{copy.brandPanel.eyebrow}</span>
          <h2 id="login-brand-title">{copy.brandPanel.title}</h2>
          <p>{copy.brandPanel.description}</p>

          <div className={styles.capabilities} aria-label={copy.brandPanel.capabilitiesLabel}>
            <span><Boxes size={16} aria-hidden="true" /> {copy.brandPanel.capabilities.requests}</span>
            <span><Route size={16} aria-hidden="true" /> {copy.brandPanel.capabilities.operations}</span>
            <span><Activity size={16} aria-hidden="true" /> {copy.brandPanel.capabilities.tracking}</span>
          </div>
        </div>

        <div className={styles.networkPreview} aria-hidden="true">
          <span className={styles.routeLine} />
          <span className={`${styles.node} ${styles.nodeCallao}`}>Callao</span>
          <span className={`${styles.node} ${styles.nodeSantiago}`}>Santiago</span>
          <span className={styles.vehicle}><Route size={18} /></span>
        </div>

        <div className={styles.signal}>
          <ShieldCheck size={16} aria-hidden="true" />
          {copy.brandPanel.signal}
        </div>
      </section>

      <section className={styles.formPanel} aria-label={copy.form.ariaLabel}>
        <div className={styles.formContent}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}><LanguageSwitcher compact /></div>
          <DemoLogin copy={copy.form} />
          <p className={styles.footer}>{copy.footer}</p>
        </div>
      </section>
    </main>
  );
}

