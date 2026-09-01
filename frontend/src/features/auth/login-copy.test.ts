import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loginCopy } from "./login-copy";

test("keeps Spanish as the active copy and English ready for a future locale switch", () => {
  assert.equal(loginCopy.es.form.title, "Bienvenido a CargoMesh");
  assert.equal(loginCopy.en.form.title, "Welcome to CargoMesh");
  assert.equal(loginCopy.es.form.emailLabel, "Correo electrónico");
  assert.equal(loginCopy.en.form.emailLabel, "Email address");
});

test("provides the same copy keys in every supported locale", () => {
  assert.deepEqual(Object.keys(loginCopy.es), Object.keys(loginCopy.en));
  assert.deepEqual(Object.keys(loginCopy.es.brand), Object.keys(loginCopy.en.brand));
  assert.deepEqual(Object.keys(loginCopy.es.brandPanel), Object.keys(loginCopy.en.brandPanel));
  assert.deepEqual(Object.keys(loginCopy.es.form), Object.keys(loginCopy.en.form));
  assert.deepEqual(
    Object.keys(loginCopy.es.brandPanel.capabilities),
    Object.keys(loginCopy.en.brandPanel.capabilities),
  );
});

test("keeps login UI copy centralized and removes redundant status copy", () => {
  const componentSource = readFileSync(
    new URL("../../components/demo-login.tsx", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../../app/(cargomesh)/login/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(componentSource, /loginCopyEs/);
  assert.match(pageSource, /loginCopyEs/);
  assert.doesNotMatch(componentSource, />Disponible</);
  assert.doesNotMatch(componentSource, /Autenticación empresarial/);
  assert.doesNotMatch(componentSource, /Supabase Auth/);
});
