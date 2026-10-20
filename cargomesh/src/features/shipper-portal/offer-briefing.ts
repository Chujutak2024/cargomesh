import type { WorkflowRecordV2 } from "./shipper-model";
import { inspectOffer, inspectRankedOption, type CommercialContext } from "./commercial-context";

type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;
type Ranking = Extract<WorkflowRecordV2, { kind: "ranking" }>;

export function buildOfferBriefing(offers: Offer[], ranking: Ranking | null, now = Date.now(), context?: CommercialContext) {
  // Legacy voice callers load only offers/ranking. Do not let missing joins become a recommendation.
  const current = context ? offers.filter((offer) => inspectOffer(offer, context, now).current) : [];
  const availableOptions = [...(context ? ranking?.data.options ?? [] : [])]
    .sort((a, b) => a.position - b.position)
    .filter((option) => context && inspectRankedOption(option, context, now).available)
    .flatMap((option) => {
      const matching = option.offerIds.map((id) => offers.find((offer) => offer.id === id));
      if (matching.some((offer) => !offer)) return [];
      const currencies = new Set(matching.map((offer) => offer?.data.price.currency));
      if (currencies.size !== 1 || !Number.isFinite(option.costCents)) return [];
      return [{ position: option.position, planId: option.planId,
        price: `${[...currencies][0]} ${(option.costCents / 100).toFixed(2)}`,
        offerCount: option.offerIds.length, offerVersions: matching.map(offer => offer!.data.offerVersion), score: option.score }];
    });
  const options = availableOptions.slice(0, 3);
  const recommended = options[0] ?? null;
  const explanation = !context && offers.length
    ? "Offer records were loaded, but the complete request, plan and opportunity references are not available in this voice context. I cannot verify eligibility, recommend or book a plan. Review the current commercial details on screen."
    : !current.length
    ? "There are no current carrier offers for this request yet. I cannot recommend or book a plan."
    : !recommended
      ? `${current.length} current carrier offer${current.length === 1 ? " has" : "s have"} arrived. There is no current, complete ranked plan to recommend yet. Review the offer terms on screen; no booking has been made.`
      : `${current.length} current carrier offer${current.length === 1 ? " has" : "s have"} arrived. `
        + `The backend currently ranks ${availableOptions.length} complete plan${availableOptions.length === 1 ? "" : "s"}. Here are the first ${options.length}. `
        + options.map((option) => `Option ${option.position}: ${option.price}, covering ${option.offerCount} carrier offer${option.offerCount === 1 ? "" : "s"}, offer version${option.offerCount === 1 ? "" : "s"} ${option.offerVersions.join(" / ")}.`).join(" ")
        + ` I recommend reviewing option ${recommended.position} first because it is the highest-ranked currently available plan under the stored scoring policy. `
        + "Check the carrier, breakdown, timing, validity and terms on screen before deciding. This recommendation does not select a plan or authorize a booking.";
  const script = context ? `Request status ${context.request.status}, revision ${context.request.draftVersion}. ${explanation}` : explanation;
  return { currentOfferCount: current.length, options, recommended, script };
}
