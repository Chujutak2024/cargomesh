"use client";

import { RoadCandidateMapView } from "@/features/v2-road-map/road-candidate-map-view";

import type { RoadCandidateMapViewProps } from "../contracts";

type Translate = (spanish: string, english: string) => string;

/**
 * HAC-14 owns request/evaluation/selection state. HAC-15 owns map rendering.
 * Keeping this boundary free of local state guarantees that cards and map use
 * the same selectedCandidateId and callback.
 */
export function RoadCandidateMapBoundary({ props }: {
  props: RoadCandidateMapViewProps;
  t: Translate;
}) {
  return <RoadCandidateMapView {...props} />;
}
