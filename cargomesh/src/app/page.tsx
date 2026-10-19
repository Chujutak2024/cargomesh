import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, PackageCheck, Truck, Route, Globe2 } from "lucide-react";

import { LandingPlanet } from "@/features/landing-planet/landing-planet";
import styles from "./landing-preview.module.css";
import { WorkspaceEntryLink } from "@/features/landing/workspace-entry-link";

export const metadata: Metadata = {
  title: "CargoMesh",
  description: "One place to plan shipments and manage transport operations.",
};

export default async function HomePage() {

  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.brand} aria-label="CargoMesh home"><Image src="/v2-workspace/cargomesh-icon.png" width={40} height={40} alt="" priority />CargoMesh</a>
      <span className={styles.preview}><span /> Connected operations</span>
      <span className={styles.language}><Globe2 size={15} aria-hidden="true" /> English</span>
    </header>
    <section className={styles.hero} aria-labelledby="landing-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>CONNECTED FREIGHT OPERATIONS</p>
        <h1 id="landing-title">Every shipment.<br />A clearer journey.</h1>
        <p className={styles.intro}>Bring your shipping needs and transport operations together. Choose your workspace to get started.</p>
        <div className={styles.choices}>
          <WorkspaceEntryLink workspace="Shipper" className={styles.choice} href="/clients"><span className={styles.icon}><PackageCheck size={23} aria-hidden="true" /></span><span><strong>I need to ship</strong><small>Create requests and follow your shipments.</small><span className={styles.action}>Explore Shipper <ArrowRight size={16} aria-hidden="true" /></span></span></WorkspaceEntryLink>
          <WorkspaceEntryLink workspace="Carrier" className={styles.choice} href="/carriers"><span className={styles.icon}><Truck size={23} aria-hidden="true" /></span><span><strong>I provide transport</strong><small>Manage your fleet, services and operations.</small><span className={styles.action}>Explore Carrier <ArrowRight size={16} aria-hidden="true" /></span></span></WorkspaceEntryLink>
        </div>
        <p className={styles.note}>Sign in to access your Client or Carrier workspace.</p>
      </div>
      <div className={styles.visual}>
        <LandingPlanet />
        <div className={styles.visualTop}><Route size={17} aria-hidden="true" /> From planning to delivery</div>
        <div className={styles.visualBottom}><span>ONE PLATFORM. TWO WORKSPACES.</span><p>Built around the people<br />who keep freight moving.</p><small>Illustrative scene · No live tracking</small></div>
      </div>
    </section>
    <footer className={styles.footer}><span>CargoMesh · Freight, connected.</span><span>Connected workspaces</span></footer>
  </main>;
}
