import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getShellIdentity() {
  try {
    const member = await requireAuthenticatedMember();
    const supabase = await createServerSupabaseClient();
    const [{ data: organization }, { data: profile }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", member.organizationId).maybeSingle(),
      supabase.from("organization_members").select("display_name").eq("id", member.memberId).maybeSingle(),
    ]);
    const org = organization as unknown as { name: string } | null;
    const person = profile as unknown as { display_name: string } | null;
    return {
      organizationName: org?.name ?? "CargoMesh",
      displayName: person?.display_name ?? member.userEmail,
      role: member.role,
    };
  } catch {
    return null;
  }
}

export default async function CargoMeshLayout({ children }: { children: ReactNode }) {
  return <AppShell identity={await getShellIdentity()}>{children}</AppShell>;
}

