import "server-only";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "./config";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  return parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}
