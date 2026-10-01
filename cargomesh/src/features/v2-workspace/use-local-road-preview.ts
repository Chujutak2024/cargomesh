"use client";

import { useEffect, useState } from "react";
import type { RoadRoutePreviewDto } from "@/features/v2-road-map/road-map-contract";

type PreviewState = {
  pair: string;
  status: "loading" | "estimated" | "unavailable";
  preview: RoadRoutePreviewDto | null;
  calculatedAt: string | null;
};

export function useLocalRoadPreview(originId: string, destinationId: string, active: boolean) {
  const pair = `${originId}:${destinationId}`;
  const supportedPair = originId === "callao" && destinationId === "arequipa";
  const [result, setResult] = useState<PreviewState | null>(null);
  const settledPair = result && result.status !== "loading" ? result.pair : null;

  useEffect(() => {
    if (!active || !supportedPair || settledPair === pair) return;
    const controller = new AbortController();
    setResult({ pair, status: "loading", preview: null, calculatedAt: null });
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/local/road-preview", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originId, destinationId }), signal: controller.signal, cache: "no-store",
        });
        const data = response.ok ? await response.json() : null;
        if (controller.signal.aborted) return;
        const preview = data?.status === "estimated" && data.routePreview?.geometrySource === "GOOGLE_ROUTES_API"
          && data.routePreview.provenanceStatus === "ESTIMATED" && Array.isArray(data.routePreview.legs)
          ? data.routePreview as RoadRoutePreviewDto : null;
        setResult({ pair, status: preview ? "estimated" : "unavailable", preview,
          calculatedAt: preview && typeof data.calculatedAt === "string" ? data.calculatedAt : null });
      } catch {
        if (!controller.signal.aborted) setResult({ pair, status: "unavailable", preview: null, calculatedAt: null });
      }
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [originId, destinationId, active, pair, supportedPair, settledPair]);

  // A response for another pair can never draw over the newly selected points.
  return supportedPair && result?.pair === pair ? result : null;
}
