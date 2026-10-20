import type { TrackingFilter } from "./tracking-presentation";
export function parseTrackingQuery(params:Pick<URLSearchParams,"get">) {
  const raw=Number(params.get("offset")??0),filter=params.get("filter");
  return {q:(params.get("q")??"").slice(0,200),filter:(["all","active","attention","completed"].includes(filter??"")?filter:"all") as TrackingFilter,
    sort:params.get("sort")==="oldest"?"oldest" as const:"recent" as const,
    offset:Number.isInteger(raw)&&raw>=0&&raw<=100000?raw:0};
}
export function trackingSearch(query:ReturnType<typeof parseTrackingQuery>) {
  const params=new URLSearchParams();if(query.q)params.set("q",query.q);if(query.filter!=="all")params.set("filter",query.filter);
  if(query.sort!=="recent")params.set("sort",query.sort);if(query.offset)params.set("offset",String(query.offset));
  return params.size?`?${params}`:"";
}
