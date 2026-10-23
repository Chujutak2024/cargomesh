import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as prototype from "./prototype-model";
import * as catalog from "./intake-options";
import * as client from "./v2-intake-client";
import * as groups from "./cargo-groups";
import { ROAD_REQUEST_FIXTURE, ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE } from "./fixtures/contract-flow.fixture";
import type { FreightRequestV2Data } from "./contracts";
import type { useIntakeController } from "./intake-controller";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const key = "cargomesh-v2-chat-request-id";
const code = ts.transpileModule(readFileSync(new URL("./intake-controller.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

/** Execute the real controller with deterministic React lifecycle and deferred native APIs. */
function setup({ storage = new Map<string, string>(), api = {} as Partial<typeof client> } = {}) {
  type Effect = { deps: unknown[]; cleanup?: () => void };
  const slots: unknown[] = [], effects: Array<() => void> = [];
  let cursor = 0, changed = false, mounted = true;
  const same = (a: unknown[], b: unknown[]) => a?.length === b?.length && a.every((item, i) => Object.is(item, b[i]));
  const hooks = {
    useState(initial: unknown) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], (next: unknown) => {
        const value = typeof next === "function" ? next(slots[i]) : next;
        if (!Object.is(value, slots[i])) { slots[i] = value; changed = true; }
      }];
    },
    useRef(initial: unknown) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useMemo(run: () => unknown, deps: unknown[]) {
      const i = cursor++, previous = slots[i] as { deps: unknown[]; value: unknown } | undefined;
      if (!previous || !same(previous.deps, deps)) slots[i] = { deps, value: run() };
      return (slots[i] as { value: unknown }).value;
    },
    useEffect(run: () => (() => void) | undefined, deps: unknown[]) {
      const i = cursor++, previous = slots[i] as Effect | undefined;
      if (!previous || !same(previous.deps, deps)) {
        const effect: Effect = { deps, cleanup: previous?.cleanup }; slots[i] = effect;
        effects.push(() => { effect.cleanup?.(); effect.cleanup = run(); });
      }
    },
  };
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  const feedbackExports: { useAssistantChangeFeedback: typeof import("./use-assistant-change-feedback").useAssistantChangeFeedback } = {} as never;
  const feedbackCode = ts.transpileModule(readFileSync(new URL("./use-assistant-change-feedback.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(feedbackCode, { exports: feedbackExports, require: (name: string) => { assert.equal(name, "react"); return hooks; },
    setTimeout: (callback: () => void, delay: number) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id: number) => timers.delete(id),
  });
  const options = catalog.getIntakeOptionsFixture();
  const native = { ...client, loadIntakeOptions: async () => ({ options: structuredClone(options), source: "api", fixtureReason: null }), ...api };
  const exports: { useIntakeController: typeof useIntakeController } = {} as never;
  vm.runInNewContext(code, { exports, crypto, requestAnimationFrame: (run: () => void) => run(), window: { sessionStorage: {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value), removeItem: (name: string) => storage.delete(name),
  } }, require: (name: string) => {
    if (name === "react") return hooks;
    if (name.includes("locale-provider")) return { useLocale: () => ({ locale: "es", t: (es: string) => es }) };
    if (name === "./use-assistant-change-feedback") return feedbackExports;
    if (name === "./prototype-model") return prototype;
    if (name === "./cargo-groups") return groups;
    if (name === "./intake-options") return catalog;
    if (name === "./v2-intake-client") return native;
    if (name.includes("road-map-props.mapper")) return { mapServiceabilityToMapViewProps: () => ({}) };
    throw Error(name);
  } });
  let state: ReturnType<typeof useIntakeController>;
  function render() {
    assert.ok(mounted);
    for (let count = 0; count < 50; count++) {
      cursor = 0; changed = false; state = exports.useIntakeController();
      while (effects.length) effects.shift()!();
      if (!changed) return state;
    }
    throw Error("Unstable controller render");
  }
  async function settle() { for (let i = 0; i < 5; i++) { await new Promise(setImmediate); render(); } return state; }
  const unmount = () => { mounted = false; for (const slot of slots) (slot as Effect)?.cleanup?.(); };
  render();
  return { render, settle, storage, timers, unmount, get state() { return state; } };
}
const loaded = () => ({ data: structuredClone(ROAD_REQUEST_FIXTURE) });
const evaluation = (version = 1) => ({ data: { ...structuredClone(ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE), evaluatedDraftVersion: version } });

test("recovery merges a correction made during loading into the same saved draft", async () => {
  const read = deferred<ReturnType<typeof loaded>>();
  const app = setup({ storage: new Map([[key, ROAD_REQUEST_FIXTURE.id]]), api: {
    getFreightRequestV2: () => read.promise as never, getRoadServiceabilityV2: async () => evaluation() as never,
  } });
  await app.settle();
  app.state.updateFromChat([{ field: "unitWeightPerUnitKg", value: "700" }]); app.render();
  read.resolve(loaded()); await app.settle();
  assert.equal(app.state.request?.id, ROAD_REQUEST_FIXTURE.id);
  assert.equal(app.state.draft.unitWeightPerUnitKg, "700");
  assert.equal(app.state.draft.unitQuantity, "8");
  assert.equal(app.state.draft.totalWeightKg, "5600");
  assert.equal(app.state.dirtyAfterCreate, true);
  assert.equal(app.state.evaluation, null);
});

test("reset while recovery is in flight cannot resurrect the previous request", async () => {
  const read = deferred<ReturnType<typeof loaded>>();
  const app = setup({ storage: new Map([[key, ROAD_REQUEST_FIXTURE.id]]), api: {
    getFreightRequestV2: () => read.promise as never, getRoadServiceabilityV2: async () => evaluation() as never,
  } });
  await app.settle(); app.state.reset(); app.render(); read.resolve(loaded()); await app.settle();
  assert.equal(app.state.request, null);
  assert.equal(app.state.draft.originFacilityId, "");
  assert.equal(app.state.submitPhase, "idle");
  assert.equal(app.storage.has(key), false);
});

test("an old evaluation cannot reappear after a correction during its read", async () => {
  const road = deferred<ReturnType<typeof evaluation>>();
  const app = setup({ storage: new Map([[key, ROAD_REQUEST_FIXTURE.id]]), api: {
    getFreightRequestV2: async () => loaded() as never, getRoadServiceabilityV2: () => road.promise as never,
  } });
  await app.settle();
  assert.equal(app.state.submitPhase, "evaluating");
  app.state.update("unitWeightPerUnitKg", "800"); app.render(); road.resolve(evaluation()); await app.settle();
  assert.equal(app.state.dirtyAfterCreate, true);
  assert.equal(app.state.evaluation, null);
  assert.equal(app.state.mapProps, null);
});

test("confirmed create, correction and revision keep one ID; reopening loads the revised values", async () => {
  let persisted: FreightRequestV2Data = structuredClone(ROAD_REQUEST_FIXTURE);
  let creates = 0, revisions = 0;
  const storage = new Map<string, string>();
  const api: Partial<typeof client> = {
    createFreightRequestV2: async value => { creates++; persisted = { ...persisted, ...value, origin: persisted.origin, destination: persisted.destination } as FreightRequestV2Data; return { data: persisted } as never; },
    reviseFreightRequestV2: async (id, expected, value) => { revisions++; assert.equal(id, persisted.id); assert.equal(expected, 1); persisted = { ...persisted, ...value, draftVersion: 2, origin: persisted.origin, destination: persisted.destination } as FreightRequestV2Data; return { data: persisted } as never; },
    getFreightRequestV2: async () => ({ data: structuredClone(persisted) }) as never,
    getRoadServiceabilityV2: async (_id, version) => evaluation(version) as never,
  };
  const app = setup({ storage, api }); await app.settle();
  app.state.loadExample(); app.render(); assert.equal(creates, 0);
  await app.state.createDraftAndEvaluate(); await app.settle();
  const review = app.state.request?.id;
  app.state.updateFromChat([{ field: "unitWeightPerUnitKg", value: "650" }]); app.render();
  assert.equal(revisions, 0); assert.equal(app.state.evaluation, null);
  await app.state.createDraftAndEvaluate(); await app.settle();
  assert.equal(creates, 1); assert.equal(revisions, 1); assert.equal(app.state.request?.id, review);
  assert.equal(app.state.request?.draftVersion, 2); assert.equal(app.state.dirtyAfterCreate, false);
  app.unmount(); const reopened = setup({ storage, api }); await reopened.settle();
  assert.equal(reopened.state.draft.unitWeightPerUnitKg, "650");
  assert.equal(reopened.state.request?.id, review); assert.equal(reopened.state.request?.draftVersion, 2);
  assert.equal(creates, 1); assert.equal(revisions, 1);
});

test("corrections made during a save keep the saved ID but cannot revive its older ROAD result", async () => {
  const road = deferred<ReturnType<typeof evaluation>>();
  const app = setup({ api: {
    createFreightRequestV2: async () => loaded() as never,
    getFreightRequestV2: async () => loaded() as never,
    getRoadServiceabilityV2: () => road.promise as never,
  } });
  await app.settle(); app.state.loadExample(); app.render();
  const saving = app.state.createDraftAndEvaluate(); await app.settle();
  app.state.updateFromChat([{ field: "unitWeightPerUnitKg", value: "750" }]); app.render();
  road.resolve(evaluation()); await saving; await app.settle();
  assert.equal(app.state.request?.id, ROAD_REQUEST_FIXTURE.id);
  assert.equal(app.state.draft.unitWeightPerUnitKg, "750");
  assert.equal(app.state.dirtyAfterCreate, true); assert.equal(app.state.evaluation, null);
});

test("catalog refresh during recovery restarts safely and ignores the old read", async () => {
  const old = deferred<ReturnType<typeof loaded>>(); let reads = 0;
  const app = setup({ storage: new Map([[key, ROAD_REQUEST_FIXTURE.id]]), api: {
    getFreightRequestV2: async () => ++reads === 1 ? old.promise as never : loaded() as never,
    getRoadServiceabilityV2: async () => evaluation() as never,
  } });
  await app.settle(); app.state.setOptionsAttempt(n => n + 1); app.render(); await app.settle();
  assert.equal(app.state.submitPhase, "success"); assert.equal(reads, 2);
  old.resolve({ data: { ...loaded().data, draftVersion: 99 } }); await app.settle();
  assert.equal(app.state.request?.draftVersion, 1); assert.equal(app.state.submitPhase, "success");
});

test("reload discards pre-existing edits but keeps corrections arriving after reload started", async () => {
  const next = deferred<ReturnType<typeof loaded>>(); let reads = 0;
  const app = setup({ storage: new Map([[key, ROAD_REQUEST_FIXTURE.id]]), api: {
    getFreightRequestV2: async () => ++reads === 2 ? next.promise as never : loaded() as never,
    getRoadServiceabilityV2: async () => evaluation() as never,
  } });
  await app.settle(); app.state.update("cargoDescription", "old unsaved edit"); app.render();
  const reload = app.state.reloadPersisted(); await app.settle();
  app.state.updateFromChat([{ field: "unitWeightPerUnitKg", value: "900" }]); app.render();
  next.resolve(loaded()); await reload; await app.settle();
  assert.equal(app.state.draft.cargoDescription, ROAD_REQUEST_FIXTURE.cargoSpecification.description);
  assert.equal(app.state.draft.unitWeightPerUnitKg, "900");
  assert.equal(app.state.dirtyAfterCreate, true); assert.equal(app.state.evaluation, null);
});

test("unsupported recovered locations finish with an error, never an endless reading state", async () => {
  const app = setup({ storage: new Map([[key, ROAD_REQUEST_FIXTURE.id]]), api: {
    getFreightRequestV2: async () => ({ data: { ...loaded().data, origin: { ...loaded().data.origin, facilityId: null } } }) as never,
  } });
  await app.settle(); assert.equal(app.state.submitPhase, "error");
  assert.equal(app.state.submitError?.code, "REQUEST_NOT_EDITABLE_IN_INTAKE");
  assert.equal(app.state.evaluation, null);
});

test("version conflict preserves corrections and retries the same revision intent, never creates a second request", async () => {
  const keys: string[] = []; let reads = 0;
  const app = setup({ storage: new Map([[key, ROAD_REQUEST_FIXTURE.id]]), api: {
    getFreightRequestV2: async () => ({ data: { ...loaded().data, draftVersion: ++reads > 1 ? 2 : 1 } }) as never,
    getRoadServiceabilityV2: async (_id, version) => evaluation(version) as never,
    createFreightRequestV2: async () => { throw Error("Must not create another request"); },
    reviseFreightRequestV2: async (_id, version, _value, idempotency) => {
      assert.equal(version, 1); keys.push(idempotency);
      if (keys.length === 1) throw new client.V2IntakeApiError({ code: "STALE_DRAFT", message: "Conflict", status: 409, retryable: false });
      return { data: { ...loaded().data, draftVersion: 2 } } as never;
    },
  } });
  await app.settle(); app.state.update("unitWeightPerUnitKg", "850"); app.render();
  await app.state.createDraftAndEvaluate(); await app.settle();
  assert.equal(app.state.submitError?.code, "STALE_DRAFT"); assert.equal(app.state.draft.unitWeightPerUnitKg, "850");
  assert.equal(app.state.dirtyAfterCreate, true);
  await app.state.createDraftAndEvaluate(); await app.settle();
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]); assert.equal(app.state.request?.id, ROAD_REQUEST_FIXTURE.id);
});


test("assistant feedback marks only committed changes, including derived totals, without saving", async () => {
  const app = setup(); await app.settle();
  assert.equal(app.state.assistantChange, null);
  app.state.updateFromChat([{ field: "originFacilityId", value: "lima" }, { field: "destinationFacilityId", value: "germany" }]); app.render();
  assert.deepEqual(Array.from(app.state.assistantChange!.fields).sort(), ["destinationFacilityId", "originFacilityId"]);
  assert.equal(app.state.request, null); assert.equal(app.timers.size, 1);
  app.state.updateFromChat([{ field: "unitQuantity", value: "12" }, { field: "unitWeightPerUnitKg", value: "100" }, { field: "unitVolumePerUnitM3", value: "1" }]); app.render();
  assert.ok(app.state.assistantChange!.fields.includes("unitQuantity"));
  assert.ok(app.state.assistantChange!.fields.includes("totalWeightKg"));
  assert.equal(app.state.draft.totalWeightKg, "1200"); app.unmount();
});

test("no-op turns and manual edits do not produce an assistant success cue", async () => {
  const app = setup(); await app.settle();
  app.state.update("originFacilityId", "lima"); app.render(); assert.equal(app.state.assistantChange, null);
  app.state.updateFromChat([{ field: "originFacilityId", value: "lima" }]); app.render(); assert.equal(app.state.assistantChange, null);
  app.state.updateFromChat([{ field: "destinationFacilityId", value: "germany" }]); app.render();
  app.state.update("destinationFacilityId", "peru"); app.render(); assert.equal(app.state.assistantChange, null); app.unmount();
});

test("new corrections restart feedback and an old timer cannot clear the latest change", async () => {
  const app = setup(); await app.settle();
  app.state.updateFromChat([{ field: "unitQuantity", value: "10" }]); app.render();
  const first = app.state.assistantChange!.sequence, oldTimer = [...app.timers.values()][0];
  app.state.updateFromChat([{ field: "unitQuantity", value: "12" }]); app.render();
  assert.ok(app.state.assistantChange!.sequence > first); assert.equal(app.timers.size, 1);
  oldTimer.callback(); app.render(); assert.ok(app.state.assistantChange);
  const current = [...app.timers.values()][0]; assert.equal(current.delay, 4500);
  current.callback(); app.render(); assert.equal(app.state.assistantChange, null); app.unmount();
});

test("batched assistant facts retain each changed field and reset releases feedback", async () => {
  const app = setup(); await app.settle();
  app.state.updateFromChat([{ field: "originFacilityId", value: "lima" }]);
  app.state.updateFromChat([{ field: "destinationFacilityId", value: "germany" }]); app.render();
  assert.equal(app.state.assistantChange!.fields.length, 2);
  app.state.reset(); app.render(); assert.equal(app.state.assistantChange, null); assert.equal(app.timers.size, 0);
  app.state.updateFromChat([{ field: "cargoDescription", value: "pallets" }]); app.render();
  app.unmount(); assert.equal(app.timers.size, 0);
});
