
alter table public.organization_preferences
  add constraint organization_preferences_confidence_range
    check (confidence_threshold between 0 and 100),
  add constraint organization_preferences_anomaly_range
    check (anomaly_threshold_pct between 0 and 100),
  add constraint organization_preferences_billing_mode_check
    check (billing_mode in ('CORPORATE_ACCOUNT', 'INVOICE', 'EXTERNAL_CHECKOUT', 'TOKENIZED_PAYMENT_METHOD')),
  add constraint organization_preferences_selection_mode_check
    check (selection_mode in ('ASSISTED', 'SMART_AUTO'));

alter table public.freight_requests
  add constraint freight_requests_cargo_entry_method_check
    check (cargo_entry_method in ('TOTAL_WEIGHT', 'UNITS', 'PACKAGES', 'PALLETS', 'LOTS')),
  add constraint freight_requests_pickup_mode_check
    check (pickup_mode in ('ASAP', 'SCHEDULED')),
  add constraint freight_requests_weight_positive check (cargo_weight_kg > 0),
  add constraint freight_requests_budget_positive check (budget_max is null or budget_max > 0),
  add constraint freight_requests_pickup_window_check check (
    pickup_window_end is null or pickup_window_start is null or pickup_window_end > pickup_window_start
  );

alter table public.carrier_metrics
  add constraint carrier_metrics_counts_nonnegative check (
    completed_freight_requests >= 0
    and successful_freight_requests >= 0
    and route_completed_freight_requests >= 0
    and organization_completed_freight_requests >= 0
    and organization_successful_freight_requests >= 0
  ),
  add constraint carrier_metrics_success_rate_range check (success_rate between 0 and 100);

alter table public.carrier_offers
  add constraint carrier_offers_scores_range check (
    (availability_score is null or availability_score between 0 and 100)
    and (reliability_score is null or reliability_score between 0 and 100)
    and organization_history_score between 0 and 100
    and (final_score is null or final_score between 0 and 100)
  ),
  add constraint carrier_offers_transit_positive check (transit_hours is null or transit_hours > 0),
  add constraint carrier_offers_route_operations_nonnegative check (route_operations >= 0);

alter table public.freight_decisions
  add constraint freight_decisions_confidence_range check (
    confidence_score is null or confidence_score between 0 and 100
  );
;
