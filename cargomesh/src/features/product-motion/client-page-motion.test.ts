import assert from 'node:assert/strict';
import test from 'node:test';
import { CLIENT_ENTRY_MOTION, clientEntryBlocks, startClientPageMotion } from './client-page-motion-controller';

// A minimal DOM/animation adapter exercises the real observer and cleanup policy.
function page(reduced = false) {
  let mutation: MutationCallback;
  let disconnected = false;
  const frames = new Map<number, FrameRequestCallback>();
  const listeners = new Set<() => void>();
  const media = { matches: reduced, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
  const document = { defaultView: {} as unknown, activeElement: null as Element | null, hidden: false };
  class Element {
    children: Element[] = [];
    parentElement: Element | null = null;
    ownerDocument = document;
    attrs: Record<string, string> = {};
    text = 'Content';
    value = '';
    top = 20;
    calls: { keyframes: Keyframe[]; options: KeyframeAnimationOptions; animation: { canceled: boolean; cancel(): void; onfinish: (() => void) | null } }[] = [];
    constructor(public tagName = 'DIV') {}
    get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
    add(...nodes: Element[]) { nodes.forEach(node => { node.parentElement = this; this.children.push(node); }); return this; }
    getAttribute(name: string) { return this.attrs[name] ?? null; }
    matches(selector: string): boolean {
      return selector.split(',').some(part => {
        const choice = part.trim();
        if (choice.startsWith('[')) {
          const [, name, value] = choice.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/)!;
          return name in this.attrs && (value === undefined || this.attrs[name] === value);
        }
        if (choice.startsWith('.')) return this.attrs.class === choice.slice(1);
        return this.tagName === choice.toUpperCase();
      });
    }
    closest(selector: string): Element | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
    querySelector(selector: string): Element | null {
      for (const child of this.children) { if (child.matches(selector)) return child; const nested = child.querySelector(selector); if (nested) return nested; }
      return null;
    }
    contains(node: unknown): boolean { return this === node || this.children.some(child => child.contains(node)); }
    getBoundingClientRect() { return { top: this.top, bottom: this.top + 100, width: 600, height: 100 }; }
    animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = { canceled: false, cancel() { this.canceled = true; }, onfinish: null as (() => void) | null };
      this.calls.push({ keyframes, options, animation });
      return animation;
    }
  }
  document.defaultView = {
    HTMLElement: Element, innerHeight: 900, matchMedia: () => media,
    MutationObserver: class { constructor(callback: MutationCallback) { mutation = callback; } observe() {} disconnect() { disconnected = true; } },
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(1, fn); return 1; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const node = (tag = 'DIV', attrs = {}) => Object.assign(new Element(tag.toUpperCase()), { attrs });
  const root = node();
  return {
    root, node, document, media, listeners, frames,
    start: () => startClientPageMotion(root as unknown as HTMLElement),
    blocks: () => clientEntryBlocks(root as unknown as HTMLElement),
    change(target: Element, addedNodes: Element[] = [], type = 'childList') {
      if (!disconnected) mutation!([{ target, addedNodes, type } as unknown as MutationRecord], {} as MutationObserver);
    },
    flush() { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(0)); },
    reduce() { media.matches = true; listeners.forEach(fn => fn()); },
  };
}

test('page units stagger without animating both a card and its own header', () => {
  const p = page(), header = p.node('header'), a = p.node('section').add(p.node('header')), b = p.node('article');
  p.root.add(header, p.node().add(a, b));
  assert.deepEqual(p.blocks(), [header, a, b]);
  const stop = p.start();
  assert.equal(a.children[0].calls.length, 0);
  [header, a, b].forEach((node, index) => {
    assert.equal(node.calls[0].options.delay, index * CLIENT_ENTRY_MOTION.stagger);
    assert.equal(node.calls[0].options.duration, 560);
    assert.equal(node.calls[0].options.easing, 'cubic-bezier(.22,1,.36,1)');
    assert.deepEqual(node.calls[0].keyframes, [{ opacity: 0, translate: '0 22px' }, { opacity: 1, translate: '0 0' }]);
  });
  stop();
});

test('long pages cap the stagger so the last visible block never waits for the full list', () => {
  const p = page();
  p.root.add(...Array.from({ length: 20 }, () => p.node('section')));
  p.start();
  assert.equal(p.root.children[19].calls[0].options.delay, 220);
});

test('explicit card groups stagger links/buttons, including cards loaded later', () => {
  const p = page(), header = p.node('header'), list = p.node('div', { 'data-client-motion-group': '' }),
    link = p.node('a'), button = p.node('button');
  list.add(link, button); p.root.add(p.node('section').add(header, list));
  assert.deepEqual(p.blocks(), [header, link, button]);
  p.start();
  const added = p.node('a'); list.add(added); p.change(list, [added]); p.flush();
  assert.equal(added.calls.length, 1);
  assert.equal(link.calls.length, 1);
});

test('async cards enter once; ordinary text changes do not replay the page', () => {
  const p = page(), existing = p.node('section');
  p.root.add(existing);
  p.start(); existing.calls[0].animation.onfinish!();
  const added = p.node('section'); p.root.add(added);
  p.change(p.root, [added]); p.flush();
  assert.equal(added.calls.length, 1);
  p.change(p.root, [added]); p.flush();
  p.change(existing); p.flush();
  assert.equal(added.calls.length, 1);
  assert.equal(existing.calls.length, 1);
});

test('intake step/selection identity changes replay the new blocks without replacing fields', () => {
  const p = page(), region = p.node('div', { 'data-motion-region': '1' }), card = p.node('section'), field = p.node('input');
  field.value = 'Keep this draft'; card.add(field); region.add(card); p.root.add(region);
  p.start(); card.calls[0].animation.onfinish!();
  region.attrs['data-motion-region'] = '2'; p.change(region, [], 'attributes'); p.flush();
  assert.equal(card.calls.length, 2);
  assert.equal(card.children[0], field);
  assert.equal(field.value, 'Keep this draft');
});

test('skeletons and reduced-motion pages stay visible without entry animations', () => {
  const p = page(true), card = p.node('section'), skeleton = p.node('section', { 'aria-busy': 'true' });
  p.root.add(card, skeleton);
  p.start();
  assert.equal(card.calls.length, 0); assert.equal(skeleton.calls.length, 0);
  p.media.matches = false; skeleton.attrs['aria-busy'] = 'false';
  p.change(skeleton, [], 'attributes'); p.flush();
  // Readiness targets contain page blocks, rather than animating the former loader itself.
  assert.equal(skeleton.calls.length, 0);
});

test('focus, dialogs, map internals and offscreen content are not moved', () => {
  const p = page(), form = p.node('form'), field = p.node('input'), dialog = p.node('dialog').add(p.node('section')),
    map = p.node('div', { class: 'gm-style' }).add(p.node('section')), below = p.node('section');
  form.add(field); p.document.activeElement = field; below.top = 1000;
  p.root.add(form, dialog, map, below); p.start();
  assert.equal(form.calls.length + dialog.children[0].calls.length + map.children[0].calls.length + below.calls.length, 0);
});

test('changing reduced-motion preference cancels every active animation', () => {
  const p = page(), card = p.node('section'); p.root.add(card); p.start();
  p.reduce();
  assert.equal(card.calls[0].animation.canceled, true);
});

test('navigation cleanup cancels frames/listeners and leaves the same subtree usable', () => {
  const p = page(), card = p.node('section'); p.root.add(card); const stop = p.start();
  p.change(p.root, [p.node('section')]);
  stop();
  assert.equal(card.calls[0].animation.canceled, true);
  assert.equal(p.frames.size, 0); assert.equal(p.listeners.size, 0);
  assert.equal(p.root.children[0], card);
});
