export function workspaceSwitchGuard(input:{phase:string;hasRequest:boolean;dirtyAfterCreate:boolean;draft:unknown;emptyDraft:unknown}){
 if(['creating','revising','reading','evaluating'].includes(input.phase))return 'busy' as const;
 if(input.dirtyAfterCreate||!input.hasRequest&&JSON.stringify(input.draft)!==JSON.stringify(input.emptyDraft))return 'unsaved' as const;
 return 'ready' as const;
}

/** Mutable detail owned by the synchronous before-switch event, never by the backend. */
export type WorkspaceSwitchDetail={workspace:'client'|'carrier';confirmation?:string;blockedReason?:string};
export type WorkspaceSwitchDecision={kind:'ready'}|{kind:'confirmation';message:string}|{kind:'blocked';message:string};
export function workspaceSwitchDecision(detail:WorkspaceSwitchDetail,cancelled:boolean):WorkspaceSwitchDecision{
 const blocked=typeof detail.blockedReason==='string'?detail.blockedReason.trim().slice(0,500):'';
 const confirmation=typeof detail.confirmation==='string'?detail.confirmation.trim().slice(0,500):'';
 if(cancelled||blocked)return {kind:'blocked',message:blocked};
 if(confirmation)return {kind:'confirmation',message:confirmation};
 return {kind:'ready'};
}
