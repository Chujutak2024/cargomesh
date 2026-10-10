export const MCP_CAPABILITY_PROFILES = ["V2"] as const;
export type McpCapabilityProfile = (typeof MCP_CAPABILITY_PROFILES)[number];

export type McpCapabilityStatus = "IMPLEMENTED" | "BLOCKED";

export type McpCapabilityDescriptor = {
  toolName: "get_cargomesh_capabilities" |
    "get_v2_intake_options" | "create_v2_freight_request" | "get_v2_freight_request" | "evaluate_v2_road" | keyof typeof V2WorkflowToolDescriptions;
  profile: McpCapabilityProfile;
  status: McpCapabilityStatus;
  blockedBy: "NONE" | "V2_FREIGHT_REQUEST_SERVICE";
  source: "CARGOMESH_SHARED_SERVICE";
  legacyDependency: "NONE";
  businessSemantics: string;
};

export const MCP_CAPABILITY_CATALOG: readonly McpCapabilityDescriptor[] = [
  {
    toolName: "get_cargomesh_capabilities",
    profile: "V2",
    status: "IMPLEMENTED",
    blockedBy: "NONE",
    source: "CARGOMESH_SHARED_SERVICE",
    legacyDependency: "NONE",
    businessSemantics: "Reports the versioned MCP capability boundary and blocked V2 contracts without reading tenant data.",
  },
  {
    toolName: "get_v2_intake_options", profile: "V2", status: "IMPLEMENTED", blockedBy: "NONE",
    source: "CARGOMESH_SHARED_SERVICE", legacyDependency: "NONE",
    businessSemantics: "Reads only linked-organization V2 facilities and capture vocabulary through the HAC-12 application service; it does not imply carrier coverage.",
  },
  {
    toolName: "create_v2_freight_request", profile: "V2", status: "IMPLEMENTED", blockedBy: "NONE",
    source: "CARGOMESH_SHARED_SERVICE", legacyDependency: "NONE",
    businessSemantics: "Creates a complete V2 ROAD draft through the HAC-12 application service with idempotency.",
  },
  {
    toolName: "get_v2_freight_request", profile: "V2", status: "IMPLEMENTED", blockedBy: "NONE",
    source: "CARGOMESH_SHARED_SERVICE", legacyDependency: "NONE",
    businessSemantics: "Reads an authorized V2 draft through the HAC-12 application service.",
  },
  {
    toolName: "evaluate_v2_road", profile: "V2", status: "IMPLEMENTED", blockedBy: "NONE",
    source: "CARGOMESH_SHARED_SERVICE", legacyDependency: "NONE",
    businessSemantics: "Evaluates ROAD eligibility with HAC-12 evidence; never quotes or books.",
  },

  ...Object.entries(V2WorkflowToolDescriptions).map(([toolName, businessSemantics]) => ({
    toolName: toolName as keyof typeof V2WorkflowToolDescriptions, businessSemantics, profile: "V2" as const,
    status: "IMPLEMENTED" as const, blockedBy: "NONE" as const, source: "CARGOMESH_SHARED_SERVICE" as const, legacyDependency: "NONE" as const,
  })),
] as const;

export function implementedCapabilities(profile: McpCapabilityProfile): readonly McpCapabilityDescriptor[] {
  return MCP_CAPABILITY_CATALOG.filter((capability) =>
    capability.profile === profile && capability.status !== "BLOCKED");
}

export function capabilityReport(profile: McpCapabilityProfile) {
  return {
    profile,
    source: "CARGOMESH_CAPABILITY_CATALOG" as const,
    status: "PARTIAL" as const,
    blockedBy: ["ALEXA_PLUS_LIVE_ACCESS", "EXTERNAL_GEOCODER"] as const,
    capabilities: MCP_CAPABILITY_CATALOG.filter((capability) => capability.profile === profile),
  };
}

export function parseMcpCapabilityProfile(value: string | undefined): McpCapabilityProfile | null {
  return MCP_CAPABILITY_PROFILES.includes(value as McpCapabilityProfile)
    ? value as McpCapabilityProfile
    : null;
}
import { V2WorkflowToolDescriptions } from "@/shared/schemas/v2/mcp-workflow-catalog";
