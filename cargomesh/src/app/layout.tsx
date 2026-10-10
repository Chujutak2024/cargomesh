import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/features/i18n/locale-provider";
import { getRequestLocale } from "@/server/i18n/server";

import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CargoMesh",
  description: "CargoMesh V2: solicitudes y operaciones de transporte con API y MCP.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale}>
      <body><LocaleProvider locale={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
