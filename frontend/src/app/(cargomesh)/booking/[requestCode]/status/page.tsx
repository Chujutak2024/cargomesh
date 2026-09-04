import { BookingStatusClient } from "@/components/booking-status-client";
import { BookingWorkspace } from "@/components/booking-workspace";
import { requireOperationalRouteAccess } from "@/features/auth/route-guard";
import {
  getBookingUiFixture,
  resolveBookingOfferSet,
  resolveExplicitBookingUiScenario,
} from "@/features/freight-ui/booking-ui-fixtures";

type BookingStatusPageProps = {
  params: Promise<{ requestCode: string }>;
  searchParams: Promise<{
    scenario?: string | string[];
    offers?: string | string[];
    offer?: string | string[];
  }>;
};

export default async function BookingStatusPage({ params, searchParams }: BookingStatusPageProps) {
  await requireOperationalRouteAccess();

  const [{ requestCode }, query] = await Promise.all([params, searchParams]);
  const scenario = resolveExplicitBookingUiScenario(query.scenario)
    ?? (requestCode.toUpperCase().startsWith("FR-") ? "booking-pending" : null);

  if (!scenario) return <BookingStatusClient bookingId={requestCode} />;

  const offerId = Array.isArray(query.offer) ? query.offer[0] : query.offer;
  const offerSet = resolveBookingOfferSet(query.offers);
  const model = getBookingUiFixture({
    requestCode,
    scenario,
    offerSet,
    offerId: offerId ?? (requestCode.toUpperCase().startsWith("FR-") ? "offer-demo-1" : undefined),
  });

  return (
    <BookingWorkspace
      model={model}
      showRecovery={model.showRecovery}
      recoveryOptions={model.recoveryOptions}
      scenario={scenario}
      offerSet={offerSet}
      offerId={offerId}
    />
  );
}
