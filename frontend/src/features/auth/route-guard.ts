import "server-only";

import { redirect } from "next/navigation";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import {
  redirectActiveMemberFromLogin,
  requireActiveMemberForOperationalRoute,
} from "./route-access-policy";

export async function requireOperationalRouteAccess() {
  return requireActiveMemberForOperationalRoute(requireAuthenticatedMember, redirect);
}

export async function redirectAuthenticatedMemberFromLogin() {
  await redirectActiveMemberFromLogin(requireAuthenticatedMember, redirect);
}
