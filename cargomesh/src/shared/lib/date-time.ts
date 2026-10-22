/** Explicit display zone prevents server/browser locale differences from shifting labels. */
export function formatDateTime(value:string|null|undefined,locale='es-PE'){
  const parsed=value?new Date(value):null;
  if(!parsed||Number.isNaN(parsed.getTime()))return locale.startsWith('es')?'Desconocido':'Unknown';
  return `${new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(parsed)} PET (UTC−05:00)`;
}
