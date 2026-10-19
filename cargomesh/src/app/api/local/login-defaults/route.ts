import "server-only";
import { createLocalLoginDefaultsHandler } from "@/server/auth/local-login-defaults";
export const dynamic = "force-dynamic";
export const GET = createLocalLoginDefaultsHandler({
  enabled: process.env.CARGOMESH_LOCAL_LOGIN_DEFAULTS_ENABLED === "true",
  production: process.env.NODE_ENV === "production",
  scenario: process.env.CARGOMESH_LOCAL_PROFILE === "fleet80",
  email: process.env.CARGOMESH_LOCAL_LOGIN_EMAIL,
  password: process.env.CARGOMESH_LOCAL_LOGIN_PASSWORD,
  clientEmail: process.env.CARGOMESH_LOCAL_CLIENT_LOGIN_EMAIL,
  clientPassword: process.env.CARGOMESH_LOCAL_CLIENT_LOGIN_PASSWORD,
});
