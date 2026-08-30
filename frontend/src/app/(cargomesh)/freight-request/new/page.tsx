import { FreightIntakeForm } from "@/components/freight-intake-form";
import { freightIntakeFixture } from "@/features/freight-ui/ui-fixtures";

export default function NewFreightRequestPage() {
  return <FreightIntakeForm initialValue={freightIntakeFixture} />;
}
