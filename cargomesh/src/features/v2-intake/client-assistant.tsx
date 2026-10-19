"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { workspaceHref } from "@/features/workspace-mode/paths";
import { ConversationChat } from "./conversation-chat";
import { useIntakeSession } from "./intake-session";
import { requestToPrototypeDraft, type PrototypeStep } from "./prototype-model";

/** The form and assistant consume this same session across client navigation. */
export function ClientAssistant({ onDockedChange }: { onDockedChange: (docked: boolean) => void }) {
  const session = useIntakeSession();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("assistant") === "open")
      window.dispatchEvent(new CustomEvent("cargomesh:open-assistant"));
  }, [pathname]);
  const edit = (step: PrototypeStep) => {
    session.setStep(step);
    session.setMaxVisited((current) => Math.max(current, step) as PrototypeStep);
    session.setIssues([]);
    if (!pathname.endsWith("/freight-request/new")) router.push(workspaceHref("/freight-request/new", window.location.pathname));
    else requestAnimationFrame(() => document.getElementById(`prototype-step-${step}`)?.focus());
  };
  const catalogStatus = session.optionsSource === "loading" ? "loading" : session.optionsSource === "error" ? "error"
    : !session.optionCoverage.complete || session.optionCoverage.emptyFacilities ? "empty" : "ready";
  return <ConversationChat presentation="workspace" draft={session.draft} options={session.activeOptions}
    optionsSource={session.optionsSource === "fixture" ? "fixture" : "api"} request={session.request}
    evaluation={session.evaluation} error={session.submitError} draftDirty={session.dirtyAfterCreate}
    canRevise={Boolean(session.request && requestToPrototypeDraft(session.request) && session.request.status === "DRAFT")}
    busy={["creating", "revising", "reading", "evaluating"].includes(session.submitPhase)}
    catalogStatus={catalogStatus} catalogError={session.optionsError?.message}
    onRetryCatalog={() => session.setOptionsAttempt((attempt) => attempt + 1)} onDockedChange={onDockedChange}
    onFields={session.updateFromChat} onSave={() => { void session.createDraftAndEvaluate(); }}
    onRead={() => { void session.retryAfterCreate(); }} onEvaluate={() => { void session.retryAfterCreate(); }}
    onEdit={edit} onReload={() => { void session.reloadPersisted(); }} onStartOver={session.reset} />;
}
