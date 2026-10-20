import "server-only";
import {cache} from 'react';

import { createServerSupabaseClient } from "../db/supabase/server";

export type AuthenticatedMemberContext = {
  userId: string;
  userEmail: string;
  memberId: string;
  organizationId: string;
  role: "OWNER" | "SUPERVISOR" | "REQUESTER";
  status: string;
};

type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  role: string;
  status: string;
};

/**
 * Validates the current user session and active organization membership.
 * Throws actionable errors if unauthenticated or membership is not active.
 */
async function resolveAuthenticatedMember(
  organizationId: string | null,
): Promise<AuthenticatedMemberContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("UNAUTHENTICATED: No valid active session.");
  }

  let memberQuery = supabase
    .from("organization_members")
    .select("id, organization_id, role, status, organizations!inner(status)")
    .eq("auth_user_id", user.id)
    .eq("status", "ACTIVE")
    .eq("organizations.status", "ACTIVE")
    .order("organization_id");

  if (organizationId) {
    memberQuery = memberQuery.eq("organization_id", organizationId);
  }

  const { data: memberData, error: memberError } = await memberQuery.limit(1).maybeSingle();

  if (memberError || !memberData) {
    throw new Error("FORBIDDEN: User has no active organization membership.");
  }

  const member = memberData as unknown as OrganizationMemberRow;
  const role = member.role as "OWNER" | "SUPERVISOR" | "REQUESTER";



  return {
    userId: user.id,
    userEmail: user.email || "",
    memberId: member.id,
    organizationId: member.organization_id,
    role,
    status: member.status,
  };
}

// React cache is scoped to this server render, never shared between users or requests.
const memberForRender=cache(resolveAuthenticatedMember);
export async function requireAuthenticatedMember(options:{organizationId?:string;requiredRole?:'OWNER'|'SUPERVISOR'|'REQUESTER'}={}):Promise<AuthenticatedMemberContext>{
 const member=await memberForRender(options.organizationId??null);
 if(options.requiredRole&&member.role!=='OWNER'&&member.role!==options.requiredRole)throw new Error(`FORBIDDEN: Requires ${options.requiredRole} role.`);
 return member;
}
