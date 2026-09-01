export type PasswordCredentials = {
  email: string;
  password: string;
};

export type PasswordLoginErrorKind = "invalid_credentials" | "recoverable";

export type PasswordLoginResult =
  | { ok: true }
  | {
      ok: false;
      kind: PasswordLoginErrorKind;
      message: string;
    };

type SupabasePasswordAuthClient = {
  auth: {
    signInWithPassword(credentials: PasswordCredentials): Promise<{
      data: { session: unknown | null };
      error: {
        code?: string;
        status?: number;
      } | null;
    }>;
  };
};

const INVALID_CREDENTIALS_MESSAGE =
  "El correo o la contraseña no son válidos. Verifica los datos e inténtalo nuevamente.";

export const RECOVERABLE_LOGIN_ERROR_MESSAGE =
  "No pudimos iniciar sesión en este momento. Revisa tu conexión e inténtalo nuevamente.";

function isInvalidCredentials(error: { code?: string; status?: number }) {
  return error.code === "invalid_credentials" || error.status === 400;
}

export async function signInWithPassword(
  client: SupabasePasswordAuthClient,
  credentials: PasswordCredentials,
): Promise<PasswordLoginResult> {
  try {
    const { data, error } = await client.auth.signInWithPassword(credentials);

    if (error) {
      if (isInvalidCredentials(error)) {
        return {
          ok: false,
          kind: "invalid_credentials",
          message: INVALID_CREDENTIALS_MESSAGE,
        };
      }

      return {
        ok: false,
        kind: "recoverable",
        message: RECOVERABLE_LOGIN_ERROR_MESSAGE,
      };
    }

    if (!data.session) {
      return {
        ok: false,
        kind: "recoverable",
        message: RECOVERABLE_LOGIN_ERROR_MESSAGE,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      kind: "recoverable",
      message: RECOVERABLE_LOGIN_ERROR_MESSAGE,
    };
  }
}
