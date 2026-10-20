/** URL context is a preference, never an authorization grant. */
export function authorizedCarrierFromSearch(ids: readonly string[], current: string, search: string) {
  const requested = new URLSearchParams(search).get('carrier');
  if (requested !== null) return ids.includes(requested) ? requested : '';
  return ids.includes(current) ? current : ids[0] ?? '';
}

/** Preserve the authorized selection through same-workspace links and reloads. */
export function carrierContextHref(href: string, currentHref: string) {
  const current = new URL(currentHref), target = new URL(href, current);
  if (target.origin !== current.origin || !/^\/carriers(?:\/|$)/.test(target.pathname)) return null;
  const currentCarrier = current.searchParams.get('carrier');
  if (!target.searchParams.has('carrier') && currentCarrier) target.searchParams.set('carrier', currentCarrier);
  if (currentCarrier && target.searchParams.get('carrier') === currentCarrier
    && !target.searchParams.has('service') && current.searchParams.has('service')) {
    target.searchParams.set('service', current.searchParams.get('service')!);
  }
  return target.pathname + target.search;
}
