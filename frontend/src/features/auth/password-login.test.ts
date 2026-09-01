import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { signInWithPassword } from "./password-login";

test("returns success after Supabase creates an authenticated session", async () => {
  const calls: Array<{ email: string; password: string }> = [];
  const client = {
    auth: {
      async signInWithPassword(credentials: { email: string; password: string }) {
        calls.push(credentials);
        return { data: { session: { access_token: "test-token" } }, error: null };
      },
    },
  };

  const result = await signInWithPassword(client, {
    email: "member@example.com",
    password: "test-password",
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [{ email: "member@example.com", password: "test-password" }]);
});

test("returns a safe authentication error for invalid credentials", async () => {
  const client = {
    auth: {
      async signInWithPassword() {
        return {
          data: { session: null },
          error: { code: "invalid_credentials", status: 400 },
        };
      },
    },
  };

  const result = await signInWithPassword(client, {
    email: "member@example.com",
    password: "incorrect-password",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "invalid_credentials");
    assert.match(result.message, /correo o la contraseña no son válidos/i);
  }
});

test("keeps unexpected authentication failures recoverable", async () => {
  const client = {
    auth: {
      async signInWithPassword(): Promise<never> {
        throw new Error("network unavailable");
      },
    },
  };

  const result = await signInWithPassword(client, {
    email: "member@example.com",
    password: "test-password",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "recoverable");
    assert.match(result.message, /inténtalo nuevamente/i);
  }
});

test("keeps a non-credential HTTP 400 error recoverable", async () => {
  const client = {
    auth: {
      async signInWithPassword() {
        return {
          data: { session: null },
          error: { code: "email_not_confirmed", status: 400 },
        };
      },
    },
  };

  const result = await signInWithPassword(client, {
    email: "member@example.com",
    password: "test-password",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.kind, "recoverable");
  }
});

test("the production login does not expose a fictitious identity or a fake session", () => {
  const componentSource = readFileSync(
    new URL("../../components/demo-login.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(componentSource.includes("Carlos Mendoza"), false);
  assert.equal(componentSource.includes("ACME Mining Perú"), false);
  assert.equal(componentSource.includes("sessionStorage"), false);
  assert.match(componentSource, /createBrowserSupabaseClient/);
  assert.match(componentSource, /router\.replace\("\/dashboard"\)/);
  assert.match(componentSource, /router\.refresh\(\)/);
});
