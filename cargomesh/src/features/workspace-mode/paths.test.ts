import assert from "node:assert/strict";
import {test} from "node:test";
import {workspaceHref,workspaceApiPath,isShipperDemoPath} from "./paths";

test("demo navigation retains query, fragment and identifiers inside its namespace",()=>{
 for(const path of ["/dashboard","/requests/record-1","/freight-request/new?assistant=open","/tracking/record-1#events"])
  assert.equal(workspaceHref(path,"/demo/shipper/dashboard"),"/demo/shipper"+path);
});
test("connected navigation never acquires demo routes",()=>{
 assert.equal(workspaceHref("/requests/record-1","/dashboard"),"/requests/record-1");
 assert.equal(workspaceApiPath("/api/v2/freight/requests","/dashboard"),"/api/v2/freight/requests");
});
test("demo links cannot prefix another context, external URL or already-prefixed path",()=>{
 for(const path of ["/","/v2-workspace#/fleet","/login","/carrier-control-tower","https://example.com/requests","//example.com/requests","/demo/shipper/requests"])
  assert.equal(workspaceHref(path,"/demo/shipper/dashboard"),path);
 assert.equal(isShipperDemoPath("/demo/shipper-fake/dashboard"),false);
});
test("demo API transport is isolated from the connected API",()=>{
 assert.equal(workspaceApiPath("/api/v2/freight/requests/abc?x=1","/demo/shipper/requests"),"/api/demo/v2/freight/requests/abc?x=1");
 assert.equal(workspaceApiPath("/api/auth/logout","/demo/shipper/dashboard"),"/api/auth/logout");
 assert.equal(workspaceApiPath("https://example.com/api/v2/requests","/demo/shipper/dashboard"),"https://example.com/api/v2/requests");
});
