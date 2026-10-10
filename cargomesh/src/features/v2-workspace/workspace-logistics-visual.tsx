import styles from "../carrier-portal/portal.module.css";

/** Original matte 2.5D brand illustration. No geographic or vehicle position data. */
export function WorkspaceLogisticsVisual() {
  return <svg className={styles.logisticsVisual} viewBox="0 0 248 156" aria-hidden="true" focusable="false">
    <ellipse cx="127" cy="135" rx="106" ry="12" fill="var(--workspace-secondary)" />
    <path d="M28 108 105 64 218 110 142 152Z" fill="var(--workspace-tint-blue)" />
    <path d="m39 109 59-34 92 38-48 28" fill="none" stroke="var(--workspace-line)" strokeWidth="2" strokeDasharray="4 5" />
    <g className={styles.hubDepth}>
      <path d="m133 47 45-26 48 27-46 26Z" fill="#DCE9F2" />
      <path d="m133 47 47 27v54l-47-26Z" fill="#B7CDD9" />
      <path d="m180 74 46-26v53l-46 27Z" fill="var(--workspace-sidebar)" />
      <path d="m136 46 42-28 45 29-43 25Z" fill="var(--workspace-secondary)" stroke="var(--workspace-line)" strokeLinejoin="round" />
      <path d="m191 80 22-12v30l-22 13Z" fill="#66869A" />
      <path d="m194 84 16-9m-16 15 16-9m-16 15 16-9" stroke="#B7CDD9" strokeWidth="2" />
      <path d="m143 68 12 7v9l-12-7Zm17 10 12 7v9l-12-7Z" fill="var(--workspace-surface)" />
    </g>
    <g className={styles.cargoDepth}>
      <path d="m29 81 39-22 41 23-39 23Z" fill="#BDE1DA" />
      <path d="m29 81 41 24v33l-41-23Z" fill="var(--workspace-accent)" />
      <path d="m70 105 39-23v33l-39 23Z" fill="#105D58" />
      <path d="m49 70 40 24v13l-10 6V99L39 76Z" fill="#E5F3F0" />
      <path d="m35 119 35 20 34-20m-69 5 35 20 34-20" fill="none" stroke="var(--workspace-sidebar)" strokeWidth="3" strokeLinejoin="round" />
    </g>
    <circle cx="121" cy="119" r="6" fill="var(--workspace-surface)" stroke="var(--workspace-accent)" strokeWidth="2" />
    <circle cx="42" cy="55" r="4" fill="var(--workspace-primary)" />
    <path d="M42 49V34h46" fill="none" stroke="var(--workspace-line)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="94" cy="34" r="4" fill="var(--workspace-accent)" />
  </svg>;
}
