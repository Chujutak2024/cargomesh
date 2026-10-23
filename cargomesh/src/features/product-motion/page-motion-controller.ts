// Match the Copilot welcome: a short upward reveal, without changing layout.
export const PAGE_ENTRY_MOTION = {
  duration: 560,
  stagger: 55,
  maxDelay: 220,
  distance: 22,
  easing: 'cubic-bezier(.22,1,.36,1)',
} as const;

export type PageMotionScope = 'client' | 'carrier';
const semanticBlocks = 'header,section,article,nav,form,fieldset,ul,ol,dl,table,details,h1,h2,h3,p,[role="alert"],[role="status"]';
const excludedContent = 'svg,canvas,iframe,dialog,[role="dialog"],[role="tooltip"],[hidden],[aria-hidden="true"],[aria-busy="true"],.gm-style';
const controls = 'input,select,textarea,option,button,a';

/** Semantic entry units, not every text span or a transform on the whole page. */
export function pageEntryBlocks(root: HTMLElement, includeSelf = false, scope: PageMotionScope = 'client'): HTMLElement[] {
  const itemSelector = `[data-${scope}-motion-item]`, groupSelector = `[data-${scope}-motion-group]`;
  const blocks = `${semanticBlocks},${itemSelector}`, groups = `section,article,fieldset,${groupSelector}`;
  const excluded = `${excludedContent},[data-${scope}-motion="off"]${scope === 'carrier' ? ',[data-motion-ready="false"]' : ''}`;
  const result: HTMLElement[] = [];
  const visit = (element: HTMLElement, groupItem = false) => {
    const explicitItem = groupItem || element.matches(itemSelector);
    if (element.closest(excluded) || (!explicitItem && element.matches(controls))) return;
    const children = Array.from(element.children).filter((child): child is HTMLElement => child instanceof root.ownerDocument.defaultView!.HTMLElement);
    const explicitGroup = element.matches(groupSelector);
    const layoutGroup = explicitGroup || element.matches(groups) && element.querySelector(groups);
    if (!layoutGroup && (explicitItem || element.matches(blocks) || !element.querySelector(blocks))) {
      if (element.textContent?.trim() || children.length) result.push(element);
      return;
    }
    children.forEach(child => visit(child, explicitGroup));
  };
  if (includeSelf) visit(root, Boolean(root.parentElement?.matches(groupSelector)));
  else Array.from(root.children).forEach(child => {
    if (child instanceof root.ownerDocument.defaultView!.HTMLElement) visit(child);
  });
  return result;
}

/** One stable page subtree. No keys/remounts, navigation delays or draft changes. */
export function startPageMotion(root: HTMLElement, scope: PageMotionScope = 'client'): () => void {
  const view = root.ownerDocument.defaultView;
  if (!view || typeof root.animate !== 'function') return () => {};
  const preference = view.matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet<HTMLElement>();
  const running = new Map<HTMLElement, Animation>();
  const pending = new Map<HTMLElement, boolean>();
  let frame = 0;
  let disposed = false;

  const stop = () => {
    running.forEach(animation => animation.cancel());
    running.clear();
  };
  const reveal = (containers: Map<HTMLElement, boolean>) => {
    let index = 0;
    for (const [container, repeat] of containers) {
      const candidates = pageEntryBlocks(container, container !== root && !repeat, scope);
      for (const element of candidates) {
        if ((!repeat && seen.has(element)) || !root.contains(element)) continue;
        seen.add(element);
        const rect = element.getBoundingClientRect();
        if (preference.matches || root.ownerDocument.hidden || !rect.width || !rect.height || rect.bottom <= 0 || rect.top >= view.innerHeight) continue;
        // Do not move a field the user has already focused, or double-animate a child.
        if (element.contains(root.ownerDocument.activeElement) || [...running.keys()].some(parent => parent !== element && parent.contains(element))) continue;
        running.get(element)?.cancel();
        const animation = element.animate([
          { opacity: 0, translate: `0 ${PAGE_ENTRY_MOTION.distance}px` },
          { opacity: 1, translate: '0 0' },
        ], {
          duration: PAGE_ENTRY_MOTION.duration,
          delay: Math.min(index++ * PAGE_ENTRY_MOTION.stagger, PAGE_ENTRY_MOTION.maxDelay),
          easing: PAGE_ENTRY_MOTION.easing,
          fill: 'backwards',
        });
        running.set(element, animation);
        animation.onfinish = () => {
          if (running.get(element) === animation) running.delete(element);
          animation.cancel();
        };
      }
    }
  };
  const flush = () => {
    frame = 0;
    if (disposed) return;
    for (const [element, animation] of running) {
      if (!root.contains(element)) { animation.cancel(); running.delete(element); }
    }
    const batch = new Map(pending);
    pending.clear();
    // A new parent already covers its newly inserted descendants.
    for (const element of batch.keys()) {
      if ([...batch.keys()].some(parent => parent !== element && parent.contains(element))) batch.delete(element);
    }
    reveal(batch);
  };
  const observer = new view.MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof view.HTMLElement) {
        if (record.target.getAttribute('data-motion-ready') !== 'false' && record.target.getAttribute('hidden') === null && record.target.getAttribute('aria-busy') !== 'true') pending.set(record.target, true);
      } else {
        record.addedNodes.forEach(node => { if (node instanceof view.HTMLElement) pending.set(node, false); });
      }
    }
    if (pending.size && !frame) frame = view.requestAnimationFrame(flush);
  });
  const onPreference = () => { if (preference.matches) stop(); };
  preference.addEventListener('change', onPreference);
  reveal(new Map([[root, false]]));
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-motion-region', 'data-motion-ready', 'aria-busy', ...(scope === 'carrier' ? ['hidden'] : [])] });
  return () => {
    disposed = true;
    observer.disconnect();
    preference.removeEventListener('change', onPreference);
    view.cancelAnimationFrame(frame);
    pending.clear();
    stop();
  };
}
