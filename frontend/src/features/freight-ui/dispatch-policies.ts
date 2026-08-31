import type { OrchestrationViewModel } from "@/features/orchestration/contracts";
import type { DispatchFixtureScenario } from "./view-models";

export const DISPATCH_FIXTURE_SCENARIOS: readonly DispatchFixtureScenario[] = [
  "loading",
  "evaluating",
  "error",
  "no-match",
  "one",
  "three",
  "four",
];

export const B02_OFFER_SELECTION_ENABLED = false;

export function resolveExplicitDispatchScenario(
  value: string | string[] | undefined,
): DispatchFixtureScenario | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return DISPATCH_FIXTURE_SCENARIOS.includes(candidate as DispatchFixtureScenario)
    ? candidate as DispatchFixtureScenario
    : null;
}

export function shouldPollOrchestration(model: OrchestrationViewModel) {
  return model.status === "loading";
}

export function isRetryableOrchestrationError(model: OrchestrationViewModel) {
  return model.status === "error" && model.error.retryable;
}
