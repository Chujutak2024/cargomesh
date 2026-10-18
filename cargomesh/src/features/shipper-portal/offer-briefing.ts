import type { WorkflowRecordV2 } from "./shipper-model";
import { offerAvailability, optionAvailability } from "./commercial-view";

type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;
type Ranking = Extract<WorkflowRecordV2, { kind: "ranking" }>;

export function buildOfferBriefing(offers: Offer[], ranking: Ranking | null, now = Date.now()) {
  const current = offers.filter((offer) => offerAvailability(offer, now) === "AVAILABLE");
  const availableOptions = [...(ranking?.data.options ?? [])]
    .sort((a, b) => a.position - b.position)
    .filter((option) => optionAvailability(option, offers, now).available)
    .flatMap((option) => {
      const matching = option.offerIds.map((id) => offers.find((offer) => offer.id === id));
      if (matching.some((offer) => !offer)) return [];
      const currencies = new Set(matching.map((offer) => offer?.data.price.currency));
      if (currencies.size !== 1 || !Number.isFinite(option.costCents)) return [];
      return [{ position: option.position, planId: option.planId,
        price: `${[...currencies][0]} ${(option.costCents / 100).toFixed(2)}`,
        offerCount: option.offerIds.length, score: option.score }];
    });
  const options = availableOptions.slice(0, 3);
  const recommended = options[0] ?? null;
  const script = !current.length
    ? "There are no current carrier offers for this request yet. I cannot recommend or book a plan."
    : !recommended
      ? `${current.length} current carrier offer${current.length === 1 ? " has" : "s have"} arrived. There is no current, complete ranked plan to recommend yet. Review the offer terms on screen; no booking has been made.`
      : `${current.length} current carrier offer${current.length === 1 ? " has" : "s have"} arrived. `
        + `The backend currently ranks ${availableOptions.length} complete plan${availableOptions.length === 1 ? "" : "s"}. Here are the first ${options.length}. `
        + options.map((option) => `Option ${option.position}: ${option.price}, covering ${option.offerCount} carrier offer${option.offerCount === 1 ? "" : "s"}.`).join(" ")
        + ` I recommend reviewing option ${recommended.position} first because it is the highest-ranked currently available plan under the stored scoring policy. `
        + "Check the carrier, breakdown, timing, validity and terms on screen before deciding. This recommendation does not select a plan or authorize a booking.";
  return { currentOfferCount: current.length, options, recommended, script };
}
