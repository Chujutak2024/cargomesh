import {
  GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
  type FreightRecommendationEnvelope,
  type FreightRecommendationToolEnvelope,
} from "./contracts";
import {
  createRecommendationError,
  parseFreightRecommendationInput,
  validateFreightRecommendationEnvelope,
} from "./validation";

export const freightRecommendationInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    freightRequestId: {
      type: "string",
      format: "uuid",
      description: "Persisted FreightRequest identifier authorized by CargoMesh.",
    },
    draftVersion: {
      type: "integer",
      minimum: 1,
      description: "Monotonic persisted draft version used for stale-write protection.",
    },
  },
  required: ["freightRequestId", "draftVersion"],
} as const;

export type FreightRecommendationToolOptions = {
  request?: typeof fetch;
};

function endpointFor(freightRequestId: string, draftVersion: number): string {
  const path = `/api/freight-requests/${encodeURIComponent(
    freightRequestId,
  )}/recommendations`;
  return `${path}?draftVersion=${encodeURIComponent(String(draftVersion))}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function responseError(status: number): FreightRecommendationToolEnvelope {
  if (status === 403) {
    return createRecommendationError(
      "FORBIDDEN",
      "La sesión no puede consultar recomendaciones para esta solicitud.",
    );
  }
  if (status === 404) {
    return createRecommendationError(
      "REQUEST_NOT_FOUND",
      "La solicitud no existe o no está disponible para la sesión.",
    );
  }
  if (status === 409) {
    return createRecommendationError(
      "STALE_DRAFT",
      "La versión del borrador cambió; vuelve a consultar antes de aplicar sugerencias.",
    );
  }
  return createRecommendationError(
    "RECOMMENDATIONS_UNAVAILABLE",
    "No fue posible consultar recomendaciones en este momento.",
    status >= 500,
  );
}

export function createGetFreightRequestRecommendationsTool(
  options: FreightRecommendationToolOptions = {},
): WebMCP.ModelContextTool {
  const request = options.request ?? fetch;

  return {
    name: GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME,
    title: "Get freight request recommendations",
    description:
      "Consulta sugerencias autorizadas para un borrador persistido. No aplica cambios ni crea reservas.",
    inputSchema: freightRecommendationInputSchema,
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
    },
    execute: async (rawInput, executionOptions) => {
      const parsedInput = parseFreightRecommendationInput(rawInput);
      if (!parsedInput.ok) {
        return createRecommendationError(
          "INVALID_INPUT",
          parsedInput.message,
        );
      }

      const signal = executionOptions?.signal ?? new AbortController().signal;
      signal.throwIfAborted();

      let response: Response;
      try {
        response = await request(
          endpointFor(
            parsedInput.value.freightRequestId,
            parsedInput.value.draftVersion,
          ),
          {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
            credentials: "same-origin",
            signal,
          },
        );
      } catch (error) {
        if (signal.aborted) throw signal.reason ?? error;
        return createRecommendationError(
          "RECOMMENDATIONS_UNAVAILABLE",
          "La consulta de recomendaciones no pudo completarse.",
          true,
        );
      }

      signal.throwIfAborted();
      if (!response.ok) return responseError(response.status);

      const body = await parseResponseBody(response);
      const validated = validateFreightRecommendationEnvelope(
        body,
        parsedInput.value,
      );
      if (!validated.ok) {
        return createRecommendationError(
          "INVALID_RECOMMENDATION_RESPONSE",
          validated.message,
        );
      }

      return {
        ok: true,
        data: validated.value,
      } satisfies FreightRecommendationToolEnvelope & {
        data: FreightRecommendationEnvelope;
      };
    },
  };
}
