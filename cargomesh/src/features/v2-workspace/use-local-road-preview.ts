"use client";

import { useEffect, useRef, useState } from "react";
import type { RoadRoutePreviewDto } from "@/features/v2-road-map/road-map-contract";
import { landRoutePolicy } from "./road-locations";

type PreviewState = {
  pair: string;
  status: "loading" | "estimated" | "unavailable" | "blocked";
  preview: RoadRoutePreviewDto | null;
  calculatedAt: string | null;
  reason?: "non_road_route" | "no_land_connection";
};

export function useLocalRoadPreview(originId: string, destinationId: string, active: boolean) {
  const pair = `${originId}:${destinationId}`;
  const policy = landRoutePolicy(originId, destinationId);
  const supportedPair = policy === "previewable";
  const [result, setResult] = useState<PreviewState | null>(null);
  // Reuse only successful results in this mounted workspace, never persisted.
  const previews = useRef(new Map<string, PreviewState>());

  useEffect(() => {
    if (!active || !supportedPair) return;
    const previous = previews.current.get(pair);
    if (previous) { setResult(previous); return; }
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
        const next: PreviewState = { pair, status: preview ? "estimated" : "unavailable", preview,
          calculatedAt: preview && typeof data.calculatedAt === "string" ? data.calculatedAt : null,
          reason: data?.reason === "non_road_route" ? "non_road_route" : undefined };
        if (preview) previews.current.set(pair, next);
        setResult(next);
      } catch {
        if (!controller.signal.aborted) setResult({ pair, status: "unavailable", preview: null, calculatedAt: null });
      }
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [originId, destinationId, active, pair, supportedPair]);

  // A response for another pair can never draw over the newly selected points.
  if (policy === "disconnected_networks") return { pair, status: "blocked" as const, preview: null, calculatedAt: null, reason: "no_land_connection" as const };
  return supportedPair && result?.pair === pair ? result : null;
}
