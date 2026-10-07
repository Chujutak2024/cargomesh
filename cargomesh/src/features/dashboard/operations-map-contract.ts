export type OperationsMapMode = "planned" | "live";

export type OperationsMapPlace = {
  city: string;
  countryCode: string;
};

export type OperationsMapCheckpoint = OperationsMapPlace & {
  id: string;
  label: string;
  occurredAt: string;
};

export type OperationsMapModel = {
  /** Null before a carrier booking exists; this is still a persisted planned corridor. */
  bookingId: string | null;
  requestCode: string;
  mode: OperationsMapMode;
  origin: OperationsMapPlace;
  destination: OperationsMapPlace;
  checkpoints: OperationsMapCheckpoint[];
};
