import type { EntryWorkspace } from "./workspace-loader";

export type WorkspaceNavigationState = { workspace: EntryWorkspace; from: string; phase: "loading" | "leaving"; slow: boolean } | null;
export type WorkspaceNavigationAction =
  | { type: "begin"; workspace: EntryWorkspace; from: string }
  | { type: "route"; pathname: string }
  | { type: "slow" }
  | { type: "reset" };

/** Visual state only: route commitment, not a timer, signals navigation completion. */
export function workspaceNavigationReducer(state: WorkspaceNavigationState, action: WorkspaceNavigationAction): WorkspaceNavigationState {
  switch (action.type) {
    case "begin": return state ?? { workspace: action.workspace, from: action.from, phase: "loading", slow: false };
    case "route": return !state || action.pathname === state.from || state.phase === "leaving" ? state : { ...state, phase: "leaving", slow: false };
    case "slow": return state?.phase === "loading" ? { ...state, slow: true } : state;
    case "reset": return null;
  }
}
