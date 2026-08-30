import { DispatchView } from "@/components/dispatch-view";
import { getDispatchFixture } from "@/features/freight-ui/ui-fixtures";
import type { DispatchFixtureScenario } from "@/features/freight-ui/view-models";

type DispatchPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fixture?: string | string[] }>;
};

const fixtureScenarios: DispatchFixtureScenario[] = [
  "loading",
  "evaluating",
  "error",
  "no-match",
  "one",
  "three",
  "four",
];

function resolveScenario(value: string | string[] | undefined): DispatchFixtureScenario {
  const candidate = Array.isArray(value) ? value[0] : value;
  return fixtureScenarios.includes(candidate as DispatchFixtureScenario)
    ? candidate as DispatchFixtureScenario
    : "three";
}

export default async function DispatchPage({ params, searchParams }: DispatchPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const scenario = resolveScenario(resolvedSearchParams.fixture);
  return <DispatchView model={getDispatchFixture(scenario, id)} />;
}
