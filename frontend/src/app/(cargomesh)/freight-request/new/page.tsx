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

  return (
    <FreightIntakeLoader
      requestCode={resolveIntakeRequestCode(query.requestCode)}
      visualScenario={isIntakeVisualScenario(query.scenario)}
    />
  );
}
