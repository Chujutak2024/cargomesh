/** Presentation only: retain the original value for commands, audit and provenance. */
export function displayDemoText(value: string | null | undefined): string {
  return (value ?? "").replace(/\[(?:SYNTHETIC|SIMULATED)\]\s*/gi, "").replace(/[ \t]{2,}/g, " ").trim();
}

/** The two legacy C01 fixtures are hidden from Client discovery, not deleted. */
export function isHiddenClientFacility(code: string, id?: string): boolean {
  return ["C01_SIM_V1_A", "C01_SIM_V1_B"].includes(code.toUpperCase())
    || ["ec63f447-95ab-46ca-85c1-e9b8953ed475", "2c967237-69d6-4e5b-9586-c825d64c993d"].includes(id ?? "");
}

/** Saving another field must not silently rename a record whose visible label was cleaned. */
export function retainOriginalDisplayText(submitted: string, original: string): string {
  return submitted === displayDemoText(original) ? original : submitted;
}
