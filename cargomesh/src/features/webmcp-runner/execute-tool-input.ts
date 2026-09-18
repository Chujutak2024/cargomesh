/**
 * Creates one WebMCP execution payload that works with both API shapes seen in
 * supported browsers:
 *
 * - the current object-input contract receives the enumerable properties;
 * - the legacy DOMString contract coerces the same object to its JSON form.
 *
 * Keeping both representations on one value is important for destructive
 * tools: compatibility must never be implemented by retrying a tool call.
 */
export function createWebMcpExecuteInput<T extends object>(input: T): T {
  const inputJson = JSON.stringify(input);
  if (typeof inputJson !== "string") {
    throw new TypeError(
      "WEBMCP_INVALID_EXECUTION_INPUT: input must be JSON serializable.",
    );
  }

  const compatibleInput = JSON.parse(inputJson) as T;
  if (
    typeof compatibleInput !== "object" ||
    compatibleInput === null ||
    Array.isArray(compatibleInput)
  ) {
    throw new TypeError(
      "WEBMCP_INVALID_EXECUTION_INPUT: input must serialize to an object.",
    );
  }

  Object.defineProperties(compatibleInput, {
    [Symbol.toPrimitive]: {
      configurable: false,
      enumerable: false,
      value: () => inputJson,
      writable: false,
    },
  });

  return compatibleInput;
}
