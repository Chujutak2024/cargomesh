export function chatSendGate(text: string, working: boolean, speaking: boolean):
  | { kind: "send"; value: string }
  | { kind: "wait"; notice: string | null } {
  const value = text.trim();
  if(value.length>6000)return {kind:"wait",notice:"El mensaje supera 6.000 caracteres. Divídelo en partes; tu texto se conserva. / Message exceeds 6,000 characters. Split it into parts; your text is preserved."};
  if (!value || working) return { kind: "wait", notice: null };
  if (speaking) return { kind: "wait", notice: "Your message is still here. Stop audio, then send it again." };
  return { kind: "send", value };
}
