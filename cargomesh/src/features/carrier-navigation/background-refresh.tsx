"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useLocale } from '@/features/i18n/locale-provider';
import s from './background-refresh.module.css';

type Source = { node: HTMLElement; label: string };
type Registry = { register: (source: Source) => () => void };
const Context = createContext<Registry | null>(null);

/** Presentation only: reads and write permissions continue to be owned by each screen. */
export function BackgroundRefreshProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const sources = useRef(new Set<Source>());
  const [labels, setLabels] = useState<string[]>([]), [visible, setVisible] = useState(false);
  const sync = useCallback(() => {
    const next = [...new Set([...sources.current]
      .filter(source => source.node.isConnected && !source.node.closest('[hidden],[inert],details:not([open])'))
      .map(source => source.label))];
    setLabels(previous => previous.join('\0') === next.join('\0') ? previous : next);
  }, []);
  const register = useCallback((source: Source) => {
    sources.current.add(source); sync();
    return () => { sources.current.delete(source); sync(); };
  }, [sync]);
  const registry = useMemo(() => ({ register }), [register]);
  useEffect(() => {
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'open'] });
    return () => observer.disconnect();
  }, [sync]);
  const pending = labels.length > 0;
  useEffect(() => {
    if (!pending) { setVisible(false); return; }
    // Fast reads never flash a notice; this does not delay the read or its result.
    const timeout = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timeout);
  }, [pending]);
  return <Context.Provider value={registry}>{children}
    {visible && pending ? <aside className={s.notice} role="status" aria-live="polite" aria-atomic="true" data-carrier-refresh-notice>
      <LoaderCircle className={s.spinner} size={19} aria-hidden="true"/>
      <div><strong>{t('Actualizando información', 'Updating information')}</strong><p>{labels.length === 1 ? labels[0] : t('Consultando los últimos cambios…', 'Checking the latest changes…')}</p><small>{t('Puedes seguir trabajando.', 'You can keep working.')}</small></div>
    </aside> : null}
  </Context.Provider>;
}

/** Existing updating indicators become one non-modal side notice inside the workspace. */
export function BackgroundRefreshStatus({ label, children }: { label: string; children: ReactNode }) {
  const registry = useContext(Context), ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!registry || !ref.current) return;
    return registry.register({ node: ref.current, label });
  }, [registry, label]);
  return registry ? <span ref={ref} className={s.source} aria-hidden="true"/> : children;
}
