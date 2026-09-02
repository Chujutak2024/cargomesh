import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/features/i18n/locale-provider";
import { getRequestLocale } from "@/features/i18n/server";

import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CargoMesh",
  description: "Agent-native B2B freight orchestration through WebMCP.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale}>
      <body><LocaleProvider locale={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
