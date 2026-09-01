import { DispatchView, OrchestrationDispatch } from "@/components/dispatch-view";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { resolveExplicitDispatchScenario } from "@/features/freight-ui/dispatch-policies";
import { getDispatchFixture } from "@/features/freight-ui/ui-fixtures";

type DispatchPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scenario?: string | string[] }>;
};

export default async function DispatchPage({ params, searchParams }: DispatchPageProps) {
  await requireOperationalRouteAccess();

  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const scenario = resolveExplicitDispatchScenario(resolvedSearchParams.scenario);
  if (scenario) {
    return <DispatchView model={getDispatchFixture(scenario, id)} fixtureScenario={scenario} />;
  }
  return <OrchestrationDispatch runId={id} />;
}
