"use client";

import { useLocale } from "@/features/i18n/locale-provider";
import s from "./workspace-loader.module.css";

export type EntryWorkspace = "client" | "carrier";

/** CSS/SVG adaptations of the MIT Uiverse loaders; see THIRD_PARTY_NOTICES.md. */
export function WorkspaceLoader({ workspace, titleId, descriptionId }: {
  workspace: EntryWorkspace; titleId?: string; descriptionId?: string;
}) {
  const { t } = useLocale();
  const name = workspace === "carrier" ? "Carrier" : t("Cliente", "Client");
  return <div className={s.content} data-workspace-loader={workspace}>
    <div className={s.brand}><img src="/v2-workspace/cargomesh-icon.png" width={32} height={32} alt=""/>CargoMesh</div>
    <div className={s.scene} aria-hidden="true">
      {workspace === "carrier" ? <div className={s.truckWrapper}>
        <div className={s.horizon}/>
        <svg className={s.lamp} viewBox="0 0 50 100" fill="none"><path d="M34 99V18C34 2 12 2 12 18V23" stroke="currentColor" strokeWidth="3"/><path d="M5 26h14l-3-6H9z" fill="currentColor"/><path d="M6 29h12l10 30H0z" fill="var(--loader-teal)" opacity=".08"/></svg>
        <div className={s.truckBody}>
          <svg viewBox="0 0 198 93" fill="none">
            <path d="M135 22.5h42.264a2.5 2.5 0 0 1 2.33 1.594l12.736 32.75c.112.289.17.596.17.906V89a2.5 2.5 0 0 1-2.5 2.5h-55a2.5 2.5 0 0 1-2.5-2.5V25a2.5 2.5 0 0 1 2.5-2.5Z" stroke="var(--loader-ink)" strokeWidth="3" fill="var(--loader-teal)"/>
            <path d="M146 33.5h35.74a2.5 2.5 0 0 1 2.338 1.612l6.46 17A2.5 2.5 0 0 1 188.2 55.5H146a2.5 2.5 0 0 1-2.5-2.5V36a2.5 2.5 0 0 1 2.5-2.5Z" stroke="var(--loader-ink)" strokeWidth="3" fill="#d9f4f5"/>
            <path d="M148 38h25M143 65h7" stroke="var(--loader-ink)" strokeWidth="3" strokeLinecap="round"/>
            <rect x="187" y="63" width="5" height="7" rx="1" fill="#ffe1a3"/>
            <rect x="193" y="81" width="4" height="11" rx="1" fill="var(--loader-ink)"/>
            <rect x="6.5" y="1.5" width="121" height="90" rx="6" stroke="var(--loader-ink)" strokeWidth="3" fill="#edf6f8"/>
            <path d="M7 70h120v16H7z" fill="var(--loader-ink)"/>
            <path d="m49 34 18-10 18 10v21L67 65 49 55V34Zm0 0 18 10 18-10M67 44v21" stroke="var(--loader-teal)" strokeWidth="3.5" strokeLinejoin="round"/>
            <rect x="1" y="84" width="6" height="4" rx="1" fill="var(--loader-ink)"/>
          </svg>
        </div>
        <div className={s.truckTires}>{[0, 1].map(wheel => <svg key={wheel} viewBox="0 0 30 30"><circle cx="15" cy="15" r="13.5" fill="var(--loader-ink)"/><circle cx="15" cy="15" r="7" fill="#d5e6ec"/><path d="M15 9v12M9 15h12" stroke="var(--loader-teal)" strokeWidth="2"/><circle cx="15" cy="15" r="2" fill="var(--loader-ink)"/></svg>)}</div>
        <div className={s.road}/>
      </div> : <div className={s.bars}>{[0, 1, 2, 3, 4].map(bar => <span key={bar}/>)}</div>}
    </div>
    <div className={s.copy}>
      <h2 id={titleId}>{t("Abriendo", "Opening")} <span>{name}</span></h2>
      <p id={descriptionId} className={s.description}>{workspace === "carrier"
        ? t("Todo listo para tu próxima ruta.", "Getting ready for your next journey.")
        : t("Tus envíos, en un solo lugar.", "Your shipments, all in one place.")}</p>
    </div>
  </div>;
}

export function WorkspaceLoadingScreen({ workspace }: { workspace: EntryWorkspace }) {
  const { t } = useLocale();
  return <div className={s.screen} role="status" aria-live="polite" aria-label={workspace === "carrier" ? t("Abriendo Carrier", "Opening Carrier") : t("Abriendo Cliente", "Opening Client")}>
    <WorkspaceLoader workspace={workspace}/>
  </div>;
}
