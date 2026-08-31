import { BookingWorkspace } from "@/components/booking-workspace";
import {
  getBookingUiFixture,
  resolveBookingOfferSet,
  resolveBookingUiScenario,
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
  const offerId = Array.isArray(query.offer) ? query.offer[0] : query.offer;
  const model = getBookingUiFixture({
    requestCode,
    scenario: resolveBookingUiScenario(query.scenario),
    offerSet: resolveBookingOfferSet(query.offers),
    offerId,
  });

  return <BookingWorkspace model={model} />;
}
