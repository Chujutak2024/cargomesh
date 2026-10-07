/** Static artwork only. Labels remain real text in the map and its legend. */
export function mapMarkerSvg(kind: "origin" | "destination"): string {
  const truck = '<path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-3"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>';
  const company = '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h1m6 0h1M8 10h1m6 0h1M8 14h1m6 0h1"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="62" viewBox="0 0 52 62"><path d="M26 2C12.7 2 2 12.7 2 26c0 17 24 34 24 34s24-17 24-34C50 12.7 39.3 2 26 2Z" fill="${kind === "origin" ? "#087f8a" : "#12364b"}" stroke="white" stroke-width="2.5"/><g transform="translate(12 11) scale(1.17)" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${kind === "origin" ? truck : company}</g></svg>`;
}
