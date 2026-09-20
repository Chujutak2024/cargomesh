import { FreightIntakeLoader } from "@/components/freight-intake-loader";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";
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
  const requestedCode = resolveIntakeRequestCode(query.requestCode);

  return (
    <FreightIntakeLoader
      requestCode={requestedCode}
      defaultCleanMode={requestedCode === null}
      visualScenario={isIntakeVisualScenario(query.scenario)}
    />
  );
}
