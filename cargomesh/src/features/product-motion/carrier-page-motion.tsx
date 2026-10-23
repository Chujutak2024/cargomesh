'use client';

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { startPageMotion } from './page-motion-controller';
import { PageMotionContext } from './page-motion-context';

/** Reuse the existing scroll surface: no extra wrapper and no keyed remount. */
export function CarrierPageMotion({ identity, children, ...props }: ComponentPropsWithoutRef<'div'> & { identity: string }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (root.current) return startPageMotion(root.current, 'carrier');
  }, [identity]);
  return <PageMotionContext.Provider value={true}><div {...props} ref={root} data-carrier-page-motion={identity}>{children}</div></PageMotionContext.Provider>;
}
