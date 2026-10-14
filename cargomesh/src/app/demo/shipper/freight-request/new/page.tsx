import { V2IntakePrototype } from "@/features/v2-intake/v2-intake-prototype";
import { requireDemoPageAccess as requireOperationalRouteAccess } from "@/server/demo/access";

export const dynamic = "force-dynamic";

export default async function NewFreightRequestPage() {
  await requireOperationalRouteAccess();
  return <V2IntakePrototype />;
}
