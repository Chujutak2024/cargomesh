import { z } from "zod";

const Identity = z.object({ idempotencyKey: z.string().uuid(), observedAt: z.string().datetime({offset:true}) }).strict();
export type CommercialIntent = z.infer<typeof Identity>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
/** Stores only the identity/time of an explicit intent, never a second booking/decision state. */
export class CommercialIntents {
  private readonly memory = new Map<string, CommercialIntent>();
  get(scope: { organizationId: string; memberId: string; requestId: string }, action: "selection" | "booking",
    semanticPayload: unknown, storage?: Storage): CommercialIntent {
    const key = `cargomesh:commercial-intent:v1:${JSON.stringify([scope.organizationId, scope.memberId, scope.requestId, action, semanticPayload])}`;
    const remembered = this.memory.get(key);
    if (remembered) return remembered;
    // Corrupt/unavailable storage must not silently rotate an ambiguous prior action's key.
    const stored = storage?.getItem(key);
    const intent = stored ? Identity.parse(JSON.parse(stored)) : { idempotencyKey: crypto.randomUUID(), observedAt: new Date().toISOString() };
    storage?.setItem(key, JSON.stringify(intent)); // persist before sending, or fail without a mutation
    this.memory.set(key, intent);
    return intent;
  }
}

export function commercialIntent(value?: CommercialIntent): CommercialIntent {
  return Identity.parse(value ?? { idempotencyKey: crypto.randomUUID(), observedAt: new Date().toISOString() });
}
