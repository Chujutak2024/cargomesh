"use client";

import { useState } from "react";
import { ConversationChat } from "@/features/v2-intake/conversation-chat";
import { getIntakeOptionsFixture } from "@/features/v2-intake/intake-options";
import { EMPTY_PROTOTYPE_DRAFT, type V2IntakePrototypeDraft } from "@/features/v2-intake/prototype-model";

/** Local visual preview only; the authenticated freight page owns real API calls. */
export function ConversationPreview() {
  const [draft, setDraft] = useState<V2IntakePrototypeDraft>(EMPTY_PROTOTYPE_DRAFT);
  return <main style={{ minHeight: "100vh", background: "#ecf3f7", padding: "3rem", color: "#122b43" }}>
    <h1>CargoMesh ROAD assistant · local visual preview</h1>
    <p>Simulated selector data. This page does not create a draft or evaluate ROAD.</p>
    <p>The authenticated <code>/freight-request/new</code> page connects this same chat to the V2 APIs.</p>
    <ConversationChat draft={draft} options={getIntakeOptionsFixture().data} optionsSource="fixture" request={null} evaluation={null}
      busy={true} onField={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
      onCreate={() => {}} onRead={() => {}} onEvaluate={() => {}} />
  </main>;
}
