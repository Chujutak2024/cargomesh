import { BookingStatusClient } from "@/components/booking-status-client";
import { BookingWorkspace } from "@/components/booking-workspace";
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
  const [{ requestCode }, query] = await Promise.all([params, searchParams]);
  const scenario = resolveExplicitBookingUiScenario(query.scenario);
  if (!scenario) return <BookingStatusClient bookingId={requestCode} />;
  const offerId = Array.isArray(query.offer) ? query.offer[0] : query.offer;
  const model = getBookingUiFixture({
    requestCode,
    scenario,
    offerSet: resolveBookingOfferSet(query.offers),
    offerId,
  });

  return <BookingWorkspace model={model} />;
}
