import type {
  FreightRequestV2Data,
  RoadCandidateMapViewProps,
  RoadServiceabilityEvaluationV2Data,
} from "../contracts";

export function mapServiceabilityToMapViewProps(
  request: FreightRequestV2Data,
  evaluation: RoadServiceabilityEvaluationV2Data,
  selectedCandidateId: string | null,
  onSelectCandidate: (candidateId: string) => void,
): RoadCandidateMapViewProps {
  return {
    origin: request.origin,
    destination: request.destination,
    overallStatus: evaluation.overallStatus,
    candidates: evaluation.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      status: candidate.status,
      carrier: candidate.carrier,
      service: {
        id: candidate.service.id,
        code: candidate.service.code,
        mode: candidate.service.mode,
      },
      carrierName: candidate.carrier.commercialName,
      serviceCode: candidate.service.code,
      routePreview: candidate.routePreview ?? null,
    })),
    selectedCandidateId,
    onSelectCandidate,
  };
}
