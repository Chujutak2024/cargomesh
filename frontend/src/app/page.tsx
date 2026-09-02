import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Grape,
  Globe2,
  Network,
  Pickaxe,
  RefreshCw,
  Route,
  ShieldCheck,
} from "lucide-react";
import { landingCopyEs } from "@/features/landing/landing-copy";
import styles from "./page.module.css";

const flowIcons = [ClipboardList, Network, BarChart3, RefreshCw];
const shipperIcons = [Pickaxe, Grape, Building2];

export default function HomePage() {
  const copy = landingCopyEs;

  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label={copy.nav.ariaLabel}>
        <Link className={styles.brand} href="/" aria-label={copy.nav.homeLabel}>
          <span className={styles.brandMark} aria-hidden="true">
            <Network size={21} strokeWidth={1.8} />
          </span>
          <span>
            <strong>{copy.brand.name}</strong>
            <small>{copy.brand.label}</small>
          </span>
        </Link>

        <div className={styles.navLinks}>
          <a href="#como-funciona">{copy.nav.howItWorks}</a>
          <Link className={styles.navCta} href="/login">
            {copy.nav.signIn}
          </Link>
        </div>
      </nav>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{copy.hero.eyebrow}</p>
          <h1 id="hero-title">{copy.hero.title}</h1>
          <p className={styles.heroDescription}>{copy.hero.description}</p>

          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/login">
              {copy.hero.primaryCta}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a className={styles.secondaryAction} href="#como-funciona">
              {copy.hero.secondaryCta}
            </a>
          </div>

          <div className={styles.heroSignals} aria-label={copy.hero.signalsLabel}>
            {copy.hero.signals.map((signal) => (
              <span key={signal}>
                <CheckCircle2 size={15} aria-hidden="true" />
                {signal}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.heroVisual} aria-label={copy.hero.visualLabel}>
          <div className={styles.visualGlow} aria-hidden="true" />
          <div className={styles.routeCard}>
            <div className={styles.routeCardHeader}>
              <span className={styles.cardLabel}>{copy.hero.visual.eyebrow}</span>
              <span className={styles.liveStatus}>
                <span className={styles.statusDot} aria-hidden="true" />
                {copy.hero.visual.status}
              </span>
            </div>

            <div className={styles.routePath}>
              <div>
                <span>{copy.hero.visual.originLabel}</span>
                <strong>{copy.hero.visual.origin}</strong>
              </div>
              <Route className={styles.routeIcon} size={24} aria-hidden="true" />
              <div className={styles.routeDestination}>
                <span>{copy.hero.visual.destinationLabel}</span>
                <strong>{copy.hero.visual.destination}</strong>
              </div>
            </div>

            <div className={styles.signalStack}>
              <div className={styles.signalRow}>
                <span className={styles.signalIcon} aria-hidden="true">
                  <Globe2 size={17} />
                </span>
                <span>{copy.hero.visual.discovery}</span>
                <strong>{copy.hero.visual.discoveryValue}</strong>
              </div>
              <div className={styles.signalRow}>
                <span className={styles.signalIcon} aria-hidden="true">
                  <ShieldCheck size={17} />
                </span>
                <span>{copy.hero.visual.evidence}</span>
                <strong>{copy.hero.visual.evidenceValue}</strong>
              </div>
              <div className={styles.signalRow}>
                <span className={styles.signalIcon} aria-hidden="true">
                  <BarChart3 size={17} />
                </span>
                <span>{copy.hero.visual.ranking}</span>
                <strong>{copy.hero.visual.rankingValue}</strong>
              </div>
            </div>

            <div className={styles.confidenceRow}>
              <div>
                <span>{copy.hero.visual.confidenceLabel}</span>
                <strong>{copy.hero.visual.confidence}</strong>
              </div>
              <span className={styles.confidenceBar} aria-hidden="true">
                <span />
              </span>
            </div>
          </div>

          <div className={styles.floatingCard}>
            <span className={styles.floatingIcon} aria-hidden="true">
              <ShieldCheck size={17} />
            </span>
            <span>
              <strong>{copy.hero.visual.traceabilityTitle}</strong>
              <small>{copy.hero.visual.traceabilityDescription}</small>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.shipperSection} aria-labelledby="shipper-title">
        <div className={styles.shipperHeading}>
          <div>
            <p className={styles.eyebrow}>{copy.shippers.eyebrow}</p>
            <h2 id="shipper-title">{copy.shippers.title}</h2>
          </div>
          <div>
            <p>{copy.shippers.description}</p>
            <span className={styles.demoLabel}>{copy.shippers.demoLabel}</span>
          </div>
        </div>

        <div className={styles.shipperGrid}>
          {copy.shippers.companies.map((company, index) => {
            const Icon = shipperIcons[index];
            return (
              <article className={styles.shipperCard} key={company.name}>
                <span className={styles.shipperIcon} aria-hidden="true">
                  <Icon size={22} strokeWidth={1.7} />
                </span>
                <h3>{company.name}</h3>
                <strong>{company.highlight}</strong>
                <p>{company.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.flowSection} id="como-funciona" aria-labelledby="flow-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{copy.flow.eyebrow}</p>
          <h2 id="flow-title">{copy.flow.title}</h2>
          <p>{copy.flow.description}</p>
        </div>

        <div className={styles.flowGrid}>
          {copy.flow.steps.map((step, index) => {
            const Icon = flowIcons[index];
            return (
              <article className={styles.flowCard} key={step.number}>
                <div className={styles.flowCardTop}>
                  <span className={styles.flowNumber}>{step.number}</span>
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.valueSection} aria-labelledby="value-title">
        <div className={styles.valueIntro}>
          <p className={styles.eyebrow}>{copy.value.eyebrow}</p>
          <h2 id="value-title">{copy.value.title}</h2>
        </div>
        <div className={styles.valueGrid}>
          {copy.value.items.map((item) => (
            <article className={styles.valueCard} key={item.title}>
              <span className={styles.valueIcon} aria-hidden="true">
                <CheckCircle2 size={18} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="final-cta-title">
        <div>
          <p className={styles.eyebrow}>{copy.cta.eyebrow}</p>
          <h2 id="final-cta-title">{copy.cta.title}</h2>
          <p>{copy.cta.description}</p>
        </div>
        <Link className={styles.primaryAction} href="/login">
          {copy.cta.button}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>

      <footer className={styles.footer}>
        <span>{copy.footer}</span>
        <span>{copy.footerNote}</span>
      </footer>
    </main>
  );
}
