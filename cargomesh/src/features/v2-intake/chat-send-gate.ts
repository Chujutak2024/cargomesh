export function chatSendGate(text: string, working: boolean, speaking: boolean):
  | { kind: "send"; value: string }
  | { kind: "wait"; notice: string | null } {
  const value = text.trim();
  if (!value || working) return { kind: "wait", notice: null };
  if (speaking) return { kind: "wait", notice: "Your message is still here. Stop audio, then send it again." };
  return { kind: "send", value };
}
