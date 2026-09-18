import { buildProviderNavigationUrl } from "@/features/discovery/provider-navigation";
import type { CandidateProvider } from "@/features/providers/contracts";

import type {
  ProviderCollectionResult,
  ProviderRunnerInputs,
  ProviderToolCallIdFactory,
} from "./contracts";
import {
  createExternalProviderNavigationAdapter,
  type ExternalProviderNavigationAdapterOptions,
} from "./external-provider-navigation-adapter";
import { runProviderCollection } from "./provider-runner";

export type ExternalWebMcpValidationTarget = {
  candidate: CandidateProvider;
  inputs: ProviderRunnerInputs;
};

export type ExternalWebMcpTargetEvidence = {
  carrierId: string;
  carrierCode: string;
  matchingServiceId: string;
  providerOrigin: string;
  navigationUrl: string;
};

export type ExternalWebMcpValidationEvidence = {
  schemaVersion: "1.0";
  cargoMeshOrigin: string;
  providerOrigins: string[];
  targets: ExternalWebMcpTargetEvidence[];
  collection: ProviderCollectionResult;
};

export type RunExternalWebMcpValidationOptions = {
  targets: readonly ExternalWebMcpValidationTarget[];
  cargoMeshBaseUrl: string;
  frame: HTMLIFrameElement;
  orchestrationRunId: string;
  freightRequestId: string;
  documentHost?: ExternalProviderNavigationAdapterOptions["documentHost"];
  navigationTimeoutMs?: number;
  webMcpReadyTimeoutMs?: number;
  createToolCallId?: ProviderToolCallIdFactory;
  getAttemptNumber?(candidate: CandidateProvider): number;
  signal?: AbortSignal;
  now?: () => Date;
};

type PreparedTarget = ExternalWebMcpValidationTarget & ExternalWebMcpTargetEvidence;

function httpUrl(value: string, errorCode: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${errorCode}: value must be an absolute HTTP(S) URL.`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.origin.includes("*")
  ) {
    throw new Error(
      `${errorCode}: value must use HTTP(S) without credentials or wildcard origins.`,
    );
  }

  return url;
}

function targetIdentity(candidate: CandidateProvider): string {
  return JSON.stringify([
    candidate.carrierId,
    candidate.providerUrl,
    candidate.matchingServiceId,
  ]);
}

function prepareTargets(
  targets: readonly ExternalWebMcpValidationTarget[],
  cargoMeshBaseUrl: string,
): PreparedTarget[] {
  const cargoMeshOrigin = httpUrl(
    cargoMeshBaseUrl,
    "INVALID_CARGOMESH_ORIGIN",
  ).origin;
  const identities = new Set<string>();
  const navigationUrls = new Set<string>();

  return targets.map((target) => {
    const candidate = Object.freeze({ ...target.candidate });
    if (!candidate.matchingServiceId) {
      throw new Error(
        "INVALID_MATCHING_SERVICE_ID: matchingServiceId must not be empty.",
      );
    }

    const registeredProviderUrl = httpUrl(
      candidate.providerUrl,
      "INVALID_EXTERNAL_PROVIDER_ORIGIN",
    );
    const identity = targetIdentity(candidate);
    if (identities.has(identity)) {
      throw new Error(
        "DUPLICATE_EXTERNAL_PROVIDER_TARGET: each discovered provider service must appear once.",
      );
    }
    identities.add(identity);

    const navigationUrl = buildProviderNavigationUrl(
      candidate,
      cargoMeshBaseUrl,
    );
    const providerUrl = httpUrl(
      navigationUrl,
      "INVALID_EXTERNAL_PROVIDER_ORIGIN",
    );
    if (providerUrl.origin === cargoMeshOrigin) {
      throw new Error(
        "EXTERNAL_PROVIDER_REQUIRED: validation targets must use an origin different from CargoMesh.",
      );
    }

    if (registeredProviderUrl.origin !== providerUrl.origin) {
      throw new Error(
        "PROVIDER_ORIGIN_MISMATCH: navigation changed the registered provider origin.",
      );
    }

    if (navigationUrls.has(providerUrl.toString())) {
      throw new Error(
        "DUPLICATE_EXTERNAL_PROVIDER_TARGET: each discovered provider navigation target must appear once.",
      );
    }
    navigationUrls.add(providerUrl.toString());

    if (
      providerUrl.searchParams.getAll("serviceId").length !== 1 ||
      providerUrl.searchParams.get("serviceId") !== candidate.matchingServiceId
    ) {
      throw new Error(
        "MATCHING_SERVICE_MISMATCH: validation lost the discovered matchingServiceId.",
      );
    }

    return {
      candidate,
      inputs: structuredClone(target.inputs),
      carrierId: candidate.carrierId,
      carrierCode: candidate.carrierCode,
      matchingServiceId: candidate.matchingServiceId,
      providerOrigin: providerUrl.origin,
      navigationUrl,
    };
  });
}

/**
 * Runs the production WebMCP runner against a registered cross-origin candidate
 * snapshot and returns structural evidence for the caller to sanitize before
 * publication. It does not create demo
 * candidates, call provider handlers, persist results, or claim browser UAT.
 */
export async function runExternalWebMcpValidation(
  options: RunExternalWebMcpValidationOptions,
): Promise<ExternalWebMcpValidationEvidence> {
  const cargoMeshOrigin = httpUrl(
    options.cargoMeshBaseUrl,
    "INVALID_CARGOMESH_ORIGIN",
  ).origin;
  const targets = prepareTargets(options.targets, options.cargoMeshBaseUrl);
  const targetByIdentity = new Map(
    targets.map((target) => [targetIdentity(target.candidate), target]),
  );
  const navigation = createExternalProviderNavigationAdapter({
    frame: options.frame,
    baseUrl: options.cargoMeshBaseUrl,
    documentHost: options.documentHost,
    navigationTimeoutMs: options.navigationTimeoutMs,
    webMcpReadyTimeoutMs: options.webMcpReadyTimeoutMs,
  });

  const collection = await runProviderCollection({
    candidates: targets.map((target) => target.candidate),
    baseUrl: options.cargoMeshBaseUrl,
    orchestrationRunId: options.orchestrationRunId,
    freightRequestId: options.freightRequestId,
    navigation,
    createInputs(candidate) {
      const target = targetByIdentity.get(targetIdentity(candidate));
      if (!target) {
        throw new Error(
          "UNREGISTERED_PROVIDER_DESTINATION: candidate is not part of the validation snapshot.",
        );
      }
      return structuredClone(target.inputs);
    },
    createToolCallId: options.createToolCallId,
    getAttemptNumber: options.getAttemptNumber,
    signal: options.signal,
    now: options.now,
  });

  return {
    schemaVersion: "1.0",
    cargoMeshOrigin,
    providerOrigins: targets.map((target) => target.providerOrigin),
    targets: targets.map((target) => ({
      carrierId: target.carrierId,
      carrierCode: target.carrierCode,
      matchingServiceId: target.matchingServiceId,
      providerOrigin: target.providerOrigin,
      navigationUrl: target.navigationUrl,
    })),
    collection,
  };
}
