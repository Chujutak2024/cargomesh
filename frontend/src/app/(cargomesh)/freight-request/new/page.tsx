import { FreightIntakeLoader } from "@/components/freight-intake-loader";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import {
  DEFAULT_INTAKE_REQUEST_CODE,
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
  const requestedCode = resolveIntakeRequestCode(query.requestCode) ?? DEFAULT_INTAKE_REQUEST_CODE;

  return (
    <FreightIntakeLoader
      requestCode={requestedCode}
      defaultCleanMode={false}
      visualScenario={isIntakeVisualScenario(query.scenario)}
    />
  );
}
