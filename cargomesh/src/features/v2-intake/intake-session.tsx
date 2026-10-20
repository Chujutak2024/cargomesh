"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useIntakeController } from "./intake-controller";

const IntakeSessionContext = createContext<ReturnType<typeof useIntakeController> | null>(null);

export function IntakeSessionProvider({ children }: { children: ReactNode }) {
  const session = useIntakeController();
  return <IntakeSessionContext.Provider value={session}>{children}</IntakeSessionContext.Provider>;
}

export function useOptionalIntakeSession() { return useContext(IntakeSessionContext); }
export function useIntakeSession() {
  const session = useOptionalIntakeSession();
  if (!session) throw new Error("The client intake requires its shared workspace session.");
  return session;
}
