"use client";
import Link from 'next/link';
import type { ComponentProps } from 'react';

/** Same Carrier document: preserve shell, authorized context and loaded panels. */
export function navigateCarrier(href: string, replace = false) {
  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin || !/^\/carriers(?:\/|$)/.test(target.pathname)) return false;
  if (replace) window.history.replaceState(null, '', target.pathname + target.search);
  else window.history.pushState(null, '', target.pathname + target.search);
  window.dispatchEvent(new Event('cm-carrier-route'));
  return true;
}
export function CarrierLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} onClick={event => {
    props.onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || props.target && props.target !== '_self' || typeof props.href !== 'string'
      || !/^\/carriers(?:\/|$)/.test(window.location.pathname)) return;
    const target = new URL(props.href, window.location.href);
    if (target.origin === window.location.origin && /^\/carriers(?:\/|$)/.test(target.pathname)) {
      event.preventDefault(); navigateCarrier(props.href);
    }
  }} />;
}
