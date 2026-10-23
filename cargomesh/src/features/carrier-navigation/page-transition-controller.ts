export type PageTransition = { finished: Promise<unknown>; ready?: Promise<unknown>; skipTransition: () => void };
type Environment = {
  capture?: (update: () => void) => PageTransition;
  reduced: () => boolean;
  pending: (value: boolean) => void;
  commit: (update: () => void) => void;
};

/** Latest navigation wins. A cancelled snapshot must never replay an older route. */
export function createPageTransitionController(environment: Environment) {
  let active: PageTransition | null = null, revision = 0;
  return {
    run(update: () => void) {
      const current = ++revision;
      active?.skipTransition();
      active = null;
      if (!environment.capture || environment.reduced()) {
        environment.pending(false);
        update();
        return;
      }
      let applied = false;
      const apply = () => {
        if (applied || current !== revision) return;
        applied = true;
        environment.commit(update);
      };
      environment.pending(true);
      try {
        const transition = environment.capture(apply);
        active = transition;
        void transition.ready?.catch(() => {});
        void transition.finished.catch(() => {}).finally(() => {
          if (current !== revision) return;
          active = null;
          environment.pending(false);
        });
      } catch {
        environment.pending(false);
        apply();
      }
    },
    dispose() {
      revision++;
      active?.skipTransition();
      active = null;
      environment.pending(false);
    },
  };
}
