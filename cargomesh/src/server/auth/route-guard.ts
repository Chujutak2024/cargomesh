import "server-only";

import { redirect } from "next/navigation";
import { requireAuthenticatedMember } from "@/server/auth/member";
import {
  redirectActiveMemberFromLogin,
  requireActiveMemberForOperationalRoute,
} from "../../features/auth/route-access-policy";

export async function requireOperationalRouteAccess() {
  return requireActiveMemberForOperationalRoute(requireAuthenticatedMember, redirect);
}

export async function redirectAuthenticatedMemberFromLogin() {
  await redirectActiveMemberFromLogin(requireAuthenticatedMember, redirect);
}
