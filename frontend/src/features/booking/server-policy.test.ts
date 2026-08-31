import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import {
  mapBookingDatabaseError,
  requireRequestOrganizationMember,
  type RequestOrganizationMembershipLookup,
} from "./server-policy";

const memberByOrganization: Record<string, AuthenticatedMemberContext> = {
  "org-a": {
    userId: "user-1",
    userEmail: "member@example.com",
    memberId: "member-a",
    organizationId: "org-a",
    role: "REQUESTER",
    status: "ACTIVE",
  },
  "org-b": {
    userId: "user-1",
    userEmail: "member@example.com",
    memberId: "member-b",
    organizationId: "org-b",
    role: "OWNER",
    status: "ACTIVE",
  },
};

test("prepare and recovery resolve the member from the FreightRequest organization", async () => {
  const requestedOrganizations: string[] = [];
  const lookup: RequestOrganizationMembershipLookup = async ({ organizationId }) => {
    requestedOrganizations.push(organizationId);
    const member = memberByOrganization[organizationId];
    if (!member) throw new Error("FORBIDDEN");
    return member;
  };

  const prepareMember = await requireRequestOrganizationMember("org-b", lookup);
  const recoveryMember = await requireRequestOrganizationMember("org-b", lookup);

  assert.equal(prepareMember.memberId, "member-b");
  assert.equal(recoveryMember.memberId, "member-b");
  assert.deepEqual(requestedOrganizations, ["org-b", "org-b"]);
});

test("BOOKING_AUTHORIZATION_EXPIRED is mapped before generic authorization failures", () => {
  const expired = mapBookingDatabaseError({ message: "BOOKING_AUTHORIZATION_EXPIRED" });
  assert.equal(expired.code, "BOOKING_AUTHORIZATION_EXPIRED");
  assert.equal(expired.httpStatus, 409);

  const generic = mapBookingDatabaseError({ message: "BOOKING_AUTHORIZATION_REVOKED" });
  assert.equal(generic.code, "FORBIDDEN");
  assert.equal(generic.httpStatus, 403);
});
