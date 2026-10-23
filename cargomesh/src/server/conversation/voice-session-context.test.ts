import assert from "node:assert/strict";
import test from "node:test";
import { jwtVerify } from "jose";
import { POST } from "@/app/api/v2/conversation/voice/session/route";
import { recentVoiceContext, type VoiceTurn } from "@/features/v2-conversation-prep/voice-transcript";
import { voiceSessionContext } from "./voice-session-context";

function renewal() {
  const turns: VoiceTurn[] = [{ speaker: "user", text: "Two boxes containing one robot each.", contentId: "nova:qa:product" }];
  for (let i = 0; i < 20; i++) turns.push({ speaker: i % 2 ? "assistant" : "user", text: `Scheduling detail ${i}`, contentId: `nova:qa:${i}` });
  turns.push({speaker:"assistant", text:"When should it arrive?", contentId:"nova:qa:delivery"},
    {speaker:"user", text:"December 10 afternoon", contentId:"nova:qa:answer"});
  return recentVoiceContext(turns);
}

test("renewal projection retains initial product anchors and the latest delivery exchange", () => {
  const input = renewal(), result = voiceSessionContext(input, "shipper");
  assert.equal(input.length, 16);
  assert.deepEqual(result, input);
  assert.match(result[0], /robot/);
  assert.equal(result.at(-2), "Assistant: When should it arrive?");
  assert.equal(result.at(-1), "Customer: December 10 afternoon");
});

test("role-specific transcript budgets preserve offer limits and exclude Carrier hints", () => {
  const input = Array.from({length:20}, (_, i) => `${i}: ${"x".repeat(300)}`);
  const intake = voiceSessionContext(input, "shipper"), offers = voiceSessionContext(input, "shipper_offers");
  assert.equal(intake.length, 16); assert.ok(intake.every(turn => turn.length === 180));
  assert.deepEqual(offers, input.slice(-6).map(turn => turn.slice(0,160)));
  assert.deepEqual(voiceSessionContext(input, "carrier"), []);
  assert.deepEqual(voiceSessionContext([], "shipper"), []);
});

test("native voice-session route signs all sixteen renewal turns and rejects oversized input", async () => {
  const values = { CARGOMESH_VOICE_BRIDGE_SECRET:"synthetic-voice-renewal-test-secret-32-bytes", CARGOMESH_VOICE_WS_URL:"ws://127.0.0.1:9000", CARGOMESH_NOVA_DEMO_VOICE:"true", NODE_ENV:"test" };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key,process.env[key]]));
  Object.assign(process.env, values);
  const send = (voiceContext: string[]) => POST(new Request("http://127.0.0.1:8090/api/v2/conversation/voice/session", {
    method:"POST", headers:{origin:"http://127.0.0.1:8090","content-type":"application/json"}, body:JSON.stringify({preview:true, language:"en", voiceContext}),
  }));
  try {
    const input = renewal(), response = await send(input);
    assert.equal(response.status, 200);
    const {token} = await response.json();
    const {payload} = await jwtVerify(token, new TextEncoder().encode(values.CARGOMESH_VOICE_BRIDGE_SECRET), {issuer:"cargomesh-web",audience:"cargomesh-voice-gateway"});
    assert.equal(payload.role,"shipper"); assert.equal(payload.preview,true);
    assert.deepEqual(payload.voiceContext,input);
    assert.equal((await send([...input,"Customer: seventeenth turn"])).status,400);
    assert.equal((await send(["x".repeat(321)])).status,400);
    assert.equal(response.headers.get("Cache-Control"),"no-store, private");
  } finally {
    for (const [key,value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
