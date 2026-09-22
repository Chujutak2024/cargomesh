import { V2IntakePrototype } from "@/features/v2-intake/v2-intake-prototype";
import { requireOperationalRouteAccess } from "@/server/auth/route-guard";

export const dynamic = "force-dynamic";

export default async function NewFreightRequestPage() {
  await requireOperationalRouteAccess();
  return <V2IntakePrototype />;
}
