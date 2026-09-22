"use client";

import { useEffect } from "react";

import type { FreightRecommendationToolOptions } from "./get-freight-request-recommendations-tool";
import { registerFreightRecommendationTool } from "./recommendation-webmcp-runtime";

export type FreightRecommendationWebMcpHostProps = {
  request?: FreightRecommendationToolOptions["request"];
  onRegistrationChange?: (registered: boolean) => void;
  onRegistrationError?: (error: Error) => void;
};

/**
 * Invisible CargoMesh host for the read-only recommendation tool. B owns where
 * this component is mounted; aborting on unmount removes the tool registration.
 */
export function FreightRecommendationWebMcpHost({
  request,
  onRegistrationChange,
  onRegistrationError,
}: FreightRecommendationWebMcpHostProps) {
  useEffect(() => {
    const controller = new AbortController();

    if (!document.modelContext) {
      onRegistrationChange?.(false);
      onRegistrationError?.(
        new Error(
          "WEBMCP_UNAVAILABLE: document.modelContext is not available in CargoMesh.",
        ),
      );
      return () => controller.abort();
    }

    void registerFreightRecommendationTool(
      document,
      controller.signal,
      { request },
    )
      .then((registered) => {
        if (!controller.signal.aborted) onRegistrationChange?.(registered);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        onRegistrationChange?.(false);
        onRegistrationError?.(
          error instanceof Error ? error : new Error("WEBMCP_REGISTRATION_FAILED"),
        );
      });

    return () => controller.abort();
  }, [onRegistrationChange, onRegistrationError, request]);

  return null;
}
