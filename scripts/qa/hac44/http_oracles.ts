/** Evidence predicates preserve failures instead of changing HTTP expectations. */
export function hasRuntimeRoute(routes: any[], method: string, path: string) {
  const actual = (path.startsWith("/api/v2/") ? path : "/api/v2" + path).split("/");
  return routes.some(route => {
    const template = route.path.split("/");
    return route.method === method && template.length === actual.length
      && template.every((part: string, index: number) => part.startsWith(":") ? Boolean(actual[index]) : part === actual[index]);
  });
}
export function pairedStatus(positive: any, negative: any) {
  return positive.status !== "PASS" ? "BLOQUEADO" : negative.status;
}
export function manualOfferStatus(created: any, replay: any, before: any, afterCreate: any, afterReplay: any) {
  const id = created.response?.data?.id;
  return created.http === 201 && created.response?.meta?.idempotentReplay === false
    && replay.http === 200 && replay.response?.meta?.idempotentReplay === true
    && id && replay.response?.data?.id === id && before.count === 0
    && afterCreate.count === 1 && afterReplay.count === 1
    && afterCreate.ids.length === 1 && afterReplay.ids.length === 1
    && afterCreate.ids[0] === id && afterReplay.ids[0] === id ? "PASS" : "FAIL";
}
