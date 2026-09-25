export const MCP_CAPABILITY_PROFILES = ["V1_REGRESSION", "V2"] as const;
export type McpCapabilityProfile = (typeof MCP_CAPABILITY_PROFILES)[number];

export type McpCapabilityStatus = "IMPLEMENTED" | "BLOCKED" | "V1_REGRESSION";

export type McpCapabilityDescriptor = {
  toolName: "get_cargomesh_capabilities" | "create_freight_request" | "submit_freight_request" | "find_freight_options" | "get_freight_options";
  profile: McpCapabilityProfile;
  status: McpCapabilityStatus;
  blockedBy: "NONE" | "V2_FREIGHT_REQUEST_SERVICE";
  source: "CARGOMESH_SHARED_SERVICE" | "V1_WEBMCP_RESULT_BRIDGE";
  legacyDependency: "NONE" | "V1_WEBMCP" | "BALANCED_V1" | "V1_WEBMCP_AND_BALANCED_V1";
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
    toolName: "create_freight_request",
    profile: "V1_REGRESSION",
    status: "V1_REGRESSION",
    blockedBy: "NONE",
    source: "CARGOMESH_SHARED_SERVICE",
    legacyDependency: "NONE",
    businessSemantics: "Creates the current ROAD/FTL/BALANCED scheduled-pallet draft contract.",
  },
  {
    toolName: "submit_freight_request",
    profile: "V1_REGRESSION",
    status: "V1_REGRESSION",
    blockedBy: "NONE",
    source: "CARGOMESH_SHARED_SERVICE",
    legacyDependency: "NONE",
    businessSemantics: "Submits the current versioned V1 draft contract.",
  },
  {
    toolName: "find_freight_options",
    profile: "V1_REGRESSION",
    status: "V1_REGRESSION",
    blockedBy: "NONE",
    source: "V1_WEBMCP_RESULT_BRIDGE",
    legacyDependency: "V1_WEBMCP",
    businessSemantics: "Starts legacy provider-page orchestration; it is not V2 serviceability or discovery.",
  },
  {
    toolName: "get_freight_options",
    profile: "V1_REGRESSION",
    status: "V1_REGRESSION",
    blockedBy: "NONE",
    source: "V1_WEBMCP_RESULT_BRIDGE",
    legacyDependency: "V1_WEBMCP_AND_BALANCED_V1",
    businessSemantics: "Reads legacy Result Bridge offers and BALANCED_V1 ranking.",
  },
  {
    toolName: "create_freight_request",
    profile: "V2",
    status: "BLOCKED",
    blockedBy: "V2_FREIGHT_REQUEST_SERVICE",
    source: "CARGOMESH_SHARED_SERVICE",
    legacyDependency: "NONE",
    businessSemantics: "Reserved until a canonical V2 FreightRequest application service is implemented and verified.",
  },
  {
    toolName: "submit_freight_request",
    profile: "V2",
    status: "BLOCKED",
    blockedBy: "V2_FREIGHT_REQUEST_SERVICE",
    source: "CARGOMESH_SHARED_SERVICE",
    legacyDependency: "NONE",
    businessSemantics: "Reserved until canonical V2 FreightRequest submission is implemented and verified.",
  },
] as const;

export function implementedCapabilities(profile: McpCapabilityProfile): readonly McpCapabilityDescriptor[] {
  return MCP_CAPABILITY_CATALOG.filter((capability) =>
    capability.profile === profile && capability.status !== "BLOCKED");
}

export function capabilityReport(profile: McpCapabilityProfile) {
  return {
    profile,
    source: "CARGOMESH_CAPABILITY_CATALOG" as const,
    status: profile === "V2" ? "PARTIAL" as const : "V1_REGRESSION" as const,
    blockedBy: profile === "V2"
      ? ["V2_FREIGHT_REQUEST_SERVICE", "MCP_ACCOUNT_LINK_PERSISTENCE"] as const
      : [] as const,
    capabilities: MCP_CAPABILITY_CATALOG.filter((capability) => capability.profile === profile),
  };
}

export function parseMcpCapabilityProfile(value: string | undefined): McpCapabilityProfile | null {
  return MCP_CAPABILITY_PROFILES.includes(value as McpCapabilityProfile)
    ? value as McpCapabilityProfile
    : null;
}
