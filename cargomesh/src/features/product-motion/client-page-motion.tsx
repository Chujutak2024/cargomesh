'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { startClientPageMotion } from './client-page-motion-controller';

export function ClientPageMotion({ identity, children, className }: {
  identity: string; children: ReactNode; className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (root.current) return startClientPageMotion(root.current);
  }, [identity]);
  return <div ref={root} className={className} data-client-page-motion={identity}>{children}</div>;
}
