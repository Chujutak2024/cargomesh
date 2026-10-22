/** Apply before evaluation and ranking, preserving every other published service. */
export function recoveryCandidates<T extends {carrierId:string;capacities:readonly {calendarId?:string|null}[]}>(services:readonly T[],failedCarrierId:string|null,blockedCalendars:readonly string[]):T[]{
 const blocked=new Set(blockedCalendars);
 return services.filter(s=>s.carrierId!==failedCarrierId).map(s=>({...s,capacities:s.capacities.filter(r=>!r.calendarId||!blocked.has(r.calendarId))}));
}
