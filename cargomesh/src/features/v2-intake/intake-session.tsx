"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useIntakeController } from "./intake-controller";
import {EMPTY_PROTOTYPE_DRAFT} from './prototype-model';
import {workspaceSwitchGuard,type WorkspaceSwitchDetail} from '@/features/workspace-demo/switch-guard';

const IntakeSessionContext = createContext<ReturnType<typeof useIntakeController> | null>(null);

export function IntakeSessionProvider({ children }: { children: ReactNode }) {
  const session = useIntakeController();
  useEffect(()=>{
   const beforeSwitch=(event:Event)=>{
    const detail=(event as CustomEvent<WorkspaceSwitchDetail>).detail;
    if(!detail)return;
    const guard=workspaceSwitchGuard({phase:session.submitPhase,hasRequest:!!session.request,dirtyAfterCreate:session.dirtyAfterCreate,draft:session.draft,emptyDraft:EMPTY_PROTOTYPE_DRAFT});
    if(guard==='busy'){
     event.preventDefault();detail.blockedReason=session.t('Espera a que termine la operación.','Wait for the operation to finish.');
    }else if(guard==='unsaved')detail.confirmation=session.t('Tus cambios sin guardar se perderán al continuar.','Your unsaved changes will be lost if you continue.');
   };
   window.addEventListener('cargomesh:before-workspace-switch',beforeSwitch);
   return()=>window.removeEventListener('cargomesh:before-workspace-switch',beforeSwitch);
  },[session.submitPhase,session.request,session.dirtyAfterCreate,session.draft,session.t]);
  return <IntakeSessionContext.Provider value={session}>{children}</IntakeSessionContext.Provider>;
}

export function useOptionalIntakeSession() { return useContext(IntakeSessionContext); }
export function useIntakeSession() {
  const session = useOptionalIntakeSession();
  if (!session) throw new Error("The client intake requires its shared workspace session.");
  return session;
}
