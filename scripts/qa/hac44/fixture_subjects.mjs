// Exact actors in the approved full-flow and road-baseline scenario sources.
export function syntheticFixtureSubjectAllowed(id) {
  return /^(?:d4410000-0000-4000-8000-00000000000[123]|c2310000-0000-4000-8000-00000000000[12])$/.test(id);
}
