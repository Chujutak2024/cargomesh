import assert from "node:assert/strict";
import test from "node:test";
import { demoRequests } from "@/features/shipper-demo-preview/demo-data";
import { workspaceHref } from "@/features/workspace-mode/paths";
import { filterOperationRequests, operationDetailHref, operationView, operationsSearch, operationsHistoryState, parseOperationsQuery } from "./operations-query";

test("filter/search/sort/date/selection survive URL roundtrip, reload and detail return", () => {
  const query = parseOperationsQuery(new URLSearchParams({ q: "Lima & carga", status: "DRAFT", sort: "PICKUP_ASC",
    from: "2026-10-01", to: "2026-10-31", selected: demoRequests[0].id, offset: "500", view: "history" }));
  assert.deepEqual(parseOperationsQuery(new URLSearchParams(operationsSearch(query))), query);
  const detail = operationDetailHref(demoRequests[0].id, query, "history");
  const backState = parseOperationsQuery(new URL(detail, "http://localhost").searchParams);
  assert.deepEqual(backState, query);
  assert.equal(backState.view, "history");
});

test("untrusted query fields cannot become arbitrary back URLs or invalid filters", () => {
  const query = parseOperationsQuery(new URLSearchParams({ view: "https://evil.test", selected: "../other-tenant", status: "CONFIRMED", sort: "random",
    offset: "-4", from: "2026-02-30", to: "tomorrow" }));
  assert.deepEqual(query, { q: "", status: "ALL", sort: "UPDATED_DESC", from: "", to: "", selected: "", offset: 0, view: "requests" });
  assert.equal(operationsSearch(query), "");
});

test("history updates notify Next rather than impersonating an internal router replace", () => {
  const state = { __NA: true, _N: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["internal"], applicationData: "preserved" };
  assert.deepEqual(operationsHistoryState(state), { applicationData: "preserved" });
  assert.equal(state.__NA, true);
  assert.deepEqual(operationsHistoryState(null), {});
});

test("bounded dates, duplicate URL parameters and overly long search are normalized", () => {
  const query = parseOperationsQuery(new URLSearchParams(`q=${"a".repeat(300)}&status=DRAFT&status=BOOKED&offset=1.5&from=2026-10-10&to=2026-10-01`));
  assert.equal(query.q.length, 200);
  assert.equal(query.status, "DRAFT");
  assert.equal(query.offset, 0);
  assert.equal(query.to, "");
});

test("detail links retain the existing connected/demo route namespace", () => {
  const query = parseOperationsQuery(new URLSearchParams("q=Lima"));
  const href = operationDetailHref(demoRequests[0].id, query, "requests");
  assert.ok(workspaceHref(href, "/clients/requests").startsWith(`/clients/requests/${demoRequests[0].id}?`));
  assert.ok(workspaceHref(href, "/demo/shipper/requests").startsWith(`/demo/shipper/requests/${demoRequests[0].id}?`));
  assert.equal(operationView("/clients/bookings"), "bookings");
  assert.equal(operationView("/clients/history"), "history");
});

test("filters use only supplied authorized records and do not mutate the source collection", () => {
  const request = demoRequests[0];
  const data = [request, { ...request, id: "10000000-0000-4000-8000-000000000001", status: "CANCELLED" as const }];
  const query = parseOperationsQuery(new URLSearchParams({ q: request.referenceCode, status: request.status }));
  assert.deepEqual(filterOperationRequests(data, query, "en-US", value => value), [request]);
  assert.equal(data.length, 2);
  const none = parseOperationsQuery(new URLSearchParams({ q: "no-such-shipment" }));
  assert.deepEqual(filterOperationRequests(data, none, "en-US", value => value), []);
});

test("sorts are stable and update-date filtering uses explicit UTC boundaries", () => {
  const base = demoRequests[0];
  const earlier = { ...base, id: "10000000-0000-4000-8000-000000000001", updatedAt: "2026-10-01T00:00:00Z" };
  const later = { ...base, id: "10000000-0000-4000-8000-000000000002", updatedAt: "2026-10-02T23:59:59Z" };
  assert.deepEqual(filterOperationRequests([earlier, later], parseOperationsQuery(new URLSearchParams()), "en-US", value => value), [later, earlier]);
  assert.deepEqual(filterOperationRequests([earlier, later], parseOperationsQuery(new URLSearchParams("from=2026-10-02&to=2026-10-02")), "en-US", value => value), [later]);
  const offsetTimestamp = { ...later, updatedAt: "2026-10-03T00:30:00+01:00" };
  assert.deepEqual(filterOperationRequests([offsetTimestamp], parseOperationsQuery(new URLSearchParams("from=2026-10-02&to=2026-10-02")), "en-US", value => value), [offsetTimestamp]);
});
