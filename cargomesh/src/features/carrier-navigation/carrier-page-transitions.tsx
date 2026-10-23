"use client";
import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { createPageTransitionController, type PageTransition } from './page-transition-controller';
import './carrier-page-transitions.css';

type SnapshotDocument = Document & { startViewTransition?: (update: () => void) => PageTransition };
let navigate = (update: () => void) => update();
export function transitionCarrierPage(update: () => void) { navigate(update); }

/** Decorates the existing route events; screens and their buttons need no animation markup. */
export function CarrierPageTransitions() {
  useEffect(() => {
    const doc = document as SnapshotDocument;
    if (!doc.startViewTransition) return;
    let replaying = false;
    const controller = createPageTransitionController({
      capture: update => doc.startViewTransition!(update),
      reduced: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      pending: value => doc.documentElement.toggleAttribute('data-carrier-page-transition', value),
      commit: update => flushSync(update),
    });
    const run = (update: () => void) => {
      if (!doc.getElementById('coordinator-content')) { update(); return; }
      controller.run(update);
    };
    navigate = run;
    const route = (event: Event) => {
      if (replaying || !/^\/carriers(?:\/|$)/.test(window.location.pathname) || !doc.getElementById('coordinator-content') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // Re-dispatch inside the snapshot callback so all existing route subscribers,
      // including browser history, commit together before the new frame is captured.
      event.stopImmediatePropagation();
      controller.run(() => {
        replaying = true;
        try {
          window.dispatchEvent(event instanceof PopStateEvent
            ? new PopStateEvent(event.type, { state: event.state })
            : new Event(event.type));
        } finally { replaying = false; }
      });
    };
    const events = ['popstate', 'hashchange'];
    events.forEach(name => window.addEventListener(name, route, true));
    const revoke = () => controller.dispose();
    window.addEventListener('cm-carrier-access-revoked', revoke);
    return () => {
      events.forEach(name => window.removeEventListener(name, route, true));
      window.removeEventListener('cm-carrier-access-revoked', revoke);
      controller.dispose();
      if (navigate === run) navigate = update => update();
    };
  }, []);
  return null;
}
