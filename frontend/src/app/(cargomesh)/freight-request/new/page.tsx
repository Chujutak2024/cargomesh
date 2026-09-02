import { FreightIntakeLoader } from "@/components/freight-intake-loader";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import {
  isIntakeVisualScenario,
  resolveIntakeRequestCode,
} from "@/features/freight-requests/intake-ui-adapter";

export const dynamic = "force-dynamic";

export default async function NewFreightRequestPage({
  searchParams,
}: {
  searchParams: Promise<{
    requestCode?: string | string[];
    scenario?: string | string[];
  }>;
}) {
  await requireOperationalRouteAccess();
  const query = await searchParams;
  const hasExplicitCode = typeof query.requestCode === "string" && query.requestCode.trim().length > 0;

  return (
    <FreightIntakeLoader
      requestCode={resolveIntakeRequestCode(query.requestCode)}
      defaultCleanMode={!hasExplicitCode}
      visualScenario={isIntakeVisualScenario(query.scenario)}
    />
  );
}
