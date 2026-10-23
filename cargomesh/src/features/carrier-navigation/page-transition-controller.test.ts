import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageTransitionController, type PageTransition } from './page-transition-controller';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('unsupported and reduced-motion navigation commits immediately without a snapshot', () => {
  for (const supported of [false, true]) {
    let reads = 0, snapshots = 0;
    const controller = createPageTransitionController({
      capture: supported ? () => { snapshots++; throw new Error('must not capture'); } : undefined,
      reduced: () => true, pending: () => {}, commit: update => update(),
    });
    controller.run(() => reads++);
    assert.equal(reads, 1); assert.equal(snapshots, 0);
  }
});

test('rapid navigation skips stale updates and old completion cannot clear the new transition', async () => {
  const shots: { update: () => void; done: ReturnType<typeof deferred>; skipped: number }[] = [];
  const pending: boolean[] = [], routes: string[] = [];
  const controller = createPageTransitionController({
    reduced: () => false, pending: value => pending.push(value), commit: update => update(),
    capture(update) {
      const shot = { update, done: deferred(), skipped: 0 }; shots.push(shot);
      return { finished: shot.done.promise, skipTransition: () => { shot.skipped++; } };
    },
  });
  controller.run(() => routes.push('old'));
  controller.run(() => routes.push('latest'));
  shots[0].update(); shots[1].update(); shots[1].update();
  assert.deepEqual(routes, ['latest']); assert.equal(shots[0].skipped, 1);
  shots[0].done.resolve(); await settle(); assert.equal(pending.at(-1), true);
  shots[1].done.resolve(); await settle(); assert.equal(pending.at(-1), false);
});

test('snapshot failure still navigates exactly once and releases the animation marker', () => {
  for (const alreadyApplied of [false, true]) {
    let updates = 0, pending = false;
    const controller = createPageTransitionController({
      reduced: () => false, pending: value => { pending = value; }, commit: update => update(),
      capture(update): PageTransition { if (alreadyApplied) update(); throw new Error('snapshot unavailable'); },
    });
    controller.run(() => updates++);
    assert.equal(updates, 1); assert.equal(pending, false);
  }
});

test('skipped snapshot rejection is handled and teardown prevents a delayed route replay', async () => {
  const done = deferred(), ready = deferred(); let callback!: () => void, updates = 0, pending = false;
  const controller = createPageTransitionController({
    reduced: () => false, pending: value => { pending = value; }, commit: update => update(),
    capture(update) { callback = update; return { finished: done.promise, ready: ready.promise, skipTransition() {} }; },
  });
  controller.run(() => updates++); controller.dispose(); callback();
  ready.reject(new Error('skipped')); done.reject(new Error('disposed')); await settle();
  assert.equal(updates, 0); assert.equal(pending, false);
});
