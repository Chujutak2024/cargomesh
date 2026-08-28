export interface AnomalyCheckResult {
  isAnomaly: boolean;
  percentageDeviation: number;
  reason?: string;
}

/**
 * Checks if a carrier quote exceeds the historical average by more than +30%.
 */
export function detectPriceAnomaly(
  currentPrice: number,
  historicalAvgCost: number,
  thresholdMultiplier = 1.30
): AnomalyCheckResult {
  if (!historicalAvgCost || historicalAvgCost <= 0) {
    return { isAnomaly: false, percentageDeviation: 0 };
  }

  const deviation = ((currentPrice - historicalAvgCost) / historicalAvgCost) * 100;
  const isAnomaly = currentPrice > historicalAvgCost * thresholdMultiplier;

  return {
    isAnomaly,
    percentageDeviation: Math.round(deviation * 10) / 10,
    reason: isAnomaly
      ? `Price anomaly detected: Quote ($${currentPrice}) is +${deviation.toFixed(1)}% above the historical corridor average ($${historicalAvgCost}). Requires human review.`
      : undefined,
  };
}
