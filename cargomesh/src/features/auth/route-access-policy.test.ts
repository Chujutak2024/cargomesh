import assert from "node:assert/strict";
import test from "node:test";

import {
  redirectActiveMemberFromLogin,
  requireActiveMemberForOperationalRoute,
} from "./route-access-policy";

const redirectMarker = "NEXT_REDIRECT_TEST";

function createRedirectRecorder() {
  let destination: string | null = null;

  return {
    get destination() {
      return destination;
    },
    redirect(path: string): never {
      destination = path;
      throw new Error(redirectMarker);
    },
  };
}

test("redirects an anonymous visitor away from an operational route", async () => {
  const recorder = createRedirectRecorder();

  await assert.rejects(
    () =>
      requireActiveMemberForOperationalRoute(
        async () => {
          throw new Error("UNAUTHENTICATED: No valid active session.");
        },
        recorder.redirect,
      ),
    new RegExp(redirectMarker),
  );

  assert.equal(recorder.destination, "/login");
});

test("redirects a non-active member away from an operational route", async () => {
  const recorder = createRedirectRecorder();

  await assert.rejects(
    () =>
      requireActiveMemberForOperationalRoute(
        async () => {
          throw new Error("FORBIDDEN: User has no active organization membership.");
        },
        recorder.redirect,
      ),
    new RegExp(redirectMarker),
  );

  assert.equal(recorder.destination, "/login");
});

test("allows only a resolved active member to render an operational route", async () => {
  const member = { status: "ACTIVE", memberId: "member-test" };
  const result = await requireActiveMemberForOperationalRoute(
    async () => member,
    () => {
      throw new Error("redirect should not be called");
    },
  );

  assert.deepEqual(result, member);
});

test("redirects an active member away from login and leaves denied visitors on login", async () => {
  const activeRecorder = createRedirectRecorder();
  await assert.rejects(
    () => redirectActiveMemberFromLogin(async () => ({ status: "ACTIVE" }), activeRecorder.redirect),
    new RegExp(redirectMarker),
  );
  assert.equal(activeRecorder.destination, "/dashboard");

  for (const message of [
    "UNAUTHENTICATED: No valid active session.",
    "FORBIDDEN: User has no active organization membership.",
  ]) {
    const deniedRecorder = createRedirectRecorder();
    await redirectActiveMemberFromLogin(async () => {
      throw new Error(message);
    }, deniedRecorder.redirect);
    assert.equal(deniedRecorder.destination, null);
  }
});
