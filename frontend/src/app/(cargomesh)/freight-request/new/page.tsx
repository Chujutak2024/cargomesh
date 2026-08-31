import { FreightIntakeForm } from "@/components/freight-intake-form";
import { createFreightIntakeFixture } from "@/features/freight-ui/ui-fixtures";

export const dynamic = "force-dynamic";

export default function NewFreightRequestPage() {
  return <FreightIntakeForm initialValue={createFreightIntakeFixture()} />;
}
