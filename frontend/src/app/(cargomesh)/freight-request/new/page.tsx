import { FreightIntakeForm } from "@/components/freight-intake-form";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import { createFreightIntakeFixture } from "@/features/freight-ui/ui-fixtures";

export const dynamic = "force-dynamic";

export default async function NewFreightRequestPage() {
  await requireOperationalRouteAccess();

  return <FreightIntakeForm initialValue={createFreightIntakeFixture()} />;
}
