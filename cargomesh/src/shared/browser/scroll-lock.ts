/** Reference-counted lock: closing nested overlays out of order must not strand scrolling. */
export function createScrollLock() {
  let count = 0;
  let restore: (() => void) | undefined;
  return (doc: Document) => {
    if (count++ === 0) {
      const body = doc.body, html = doc.documentElement;
      const overflow = body.style.overflow;
      const attribute = html.getAttribute('data-cm-scroll-locked');
      body.style.overflow = 'hidden';
      html.setAttribute('data-cm-scroll-locked', 'true');
      restore = () => {
        body.style.overflow = overflow;
        if (attribute === null) html.removeAttribute('data-cm-scroll-locked');
        else html.setAttribute('data-cm-scroll-locked', attribute);
      };
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--count === 0) { restore?.(); restore = undefined; }
    };
  };
}
export const lockDocumentScroll = createScrollLock();
