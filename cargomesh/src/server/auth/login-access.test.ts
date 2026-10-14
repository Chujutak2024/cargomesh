import assert from "node:assert/strict";
import {test} from "node:test";
import {resolveLoginAccess} from "./login-access";

const carrier={carrierId:"d199a7a4-6de2-4565-879a-322725010001",operatorId:"d199a7a4-6de2-4565-879a-322725010002",role:"ADMIN" as const,carrierName:"Test",displayName:"Test"};
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test("independent access reads start concurrently instead of waiting for membership",async()=>{
 const member=deferred<boolean>(),carriers=deferred<typeof carrier[]>(),started:string[]=[];
 const pending=resolveLoginAccess("/v2-workspace",{member:()=>{started.push("member");return member.promise;},carriers:()=>{started.push("carriers");return carriers.promise;}});
 await Promise.resolve();assert.deepEqual(started.sort(),["carriers","member"]);
 carriers.resolve([carrier]);member.resolve(false);assert.equal(await pending,"/carrier-portal");
});

test("an authorized member does not wait for an irrelevant carrier read",async()=>{
 const carriers=deferred<typeof carrier[]>();
 assert.equal(await resolveLoginAccess("/v2-workspace",{member:async()=>true,carriers:()=>carriers.promise}),"/v2-workspace");
 carriers.resolve([]);
});

test("carrier access failures still deny a carrier-only entry",async()=>{
 const error=new Error("Unavailable");
 await assert.rejects(resolveLoginAccess("/v2-workspace",{member:async()=>false,carriers:async()=>{throw error;}}),failure=>failure===error);
});

test("membership read failures never become carrier-only success",async()=>{
 const error=new Error("Identity unavailable");
 await assert.rejects(resolveLoginAccess("/v2-workspace",{member:async()=>{throw error;},carriers:async()=>[carrier]}),failure=>failure===error);
});

test("a member still needs a carrier grant when explicitly requesting the carrier endpoint",async()=>{
 assert.equal(await resolveLoginAccess("/carrier-portal",{member:async()=>true,carriers:async()=>[]}),null);
});

test("no member and no grant cannot open a workspace",async()=>{
 assert.equal(await resolveLoginAccess("/v2-workspace",{member:async()=>false,carriers:async()=>[]}),null);
});

test("member destination remains independent of carrier outage",async()=>{
 assert.equal(await resolveLoginAccess("/dashboard",{member:async()=>true,carriers:async()=>{throw new Error("Unavailable");}}),"/dashboard");
});

test("external return destinations are rejected by the shared destination policy",async()=>{
 assert.equal(await resolveLoginAccess("https://example.com",{member:async()=>true,carriers:async()=>[]}),"/dashboard");
 assert.equal(await resolveLoginAccess("https://example.com",{member:async()=>false,carriers:async()=>[]}),null);
});
