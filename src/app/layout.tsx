import type { Metadata } from "next";
import { Inter, Overpass, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Plus, Bell, Layers, AlertTriangle, Cpu, ExternalLink } from "lucide-react";
import { DemoModeProvider } from "@/features/demo/demo-context";
import { StagingBar } from "@/components/layout/staging-bar";
import { HowItWorksModal } from "@/components/layout/how-it-works-modal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const overpass = Overpass({
  subsets: ["latin"],
  variable: "--font-overpass",
  weight: ["600", "700", "800"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CargoMesh — Autonomous Agentic Freight Dispatch",
  description:
    "B2B Agent-Native Logistics Orchestration with WebMCP capabilities discovery and explainable heuristic decisions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${overpass.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-paper text-ink font-sans antialiased min-h-screen flex flex-col">
        <DemoModeProvider>
          {/* Top Staging Bar */}
          <StagingBar />

          {/* Sticky Header */}
          <header className="bg-paper-raised border-b border-line px-7 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-40">
            {/* Brand & Nav */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-ink flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F3F1E9"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="1" y="7" width="14" height="10" rx="1"></rect>
                    <path d="M15 10h4l3 3v4h-7z"></path>
                    <circle cx="6" cy="19" r="2"></circle>
                    <circle cx="18" cy="19" r="2"></circle>
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-[17px] text-ink tracking-tight">
                    CargoMesh
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-pill bg-brass-soft text-brass font-bold">
                    WebMCP
                  </span>
                </div>
              </Link>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-text-secondary">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-pill hover:bg-paper hover:text-ink transition"
                >
                  Home
                </Link>
                <div className="relative group">
                  <button className="px-3 py-1.5 rounded-pill hover:bg-paper hover:text-ink transition flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-text-secondary" />
                    Carriers WebMCP
                  </button>
                  <div className="absolute left-0 top-full mt-1 w-52 py-1.5 bg-paper-raised border border-line rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <Link
                      href="/providers/andes"
                      className="block px-3.5 py-1.5 text-xs text-text-secondary hover:bg-paper hover:text-ink"
                    >
                      Andes Freight (96% SLA)
                    </Link>
                    <Link
                      href="/providers/inca"
                      className="block px-3.5 py-1.5 text-xs text-text-secondary hover:bg-paper hover:text-ink"
                    >
                      Inca Logistics (98% SLA)
                    </Link>
                    <Link
                      href="/providers/pacific"
                      className="block px-3.5 py-1.5 text-xs text-text-secondary hover:bg-paper hover:text-ink"
                    >
                      Pacific Cargo ($690 Low-Cost)
                    </Link>
                  </div>
                </div>
                <Link
                  href="/exceptions"
                  className="px-3 py-1.5 rounded-pill hover:bg-paper hover:text-ink transition flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-brass" />
                  Supervisor (P1)
                </Link>
              </nav>
            </div>

            {/* Right Action Icons & Avatar */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/freight-request/new"
                className="bg-brass-mid hover:bg-brass-bright text-[#211500] font-bold text-[13.5px] px-4 py-2 rounded-pill inline-flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nueva carga</span>
              </Link>

              <button
                className="w-[36px] h-[36px] rounded-full border border-line bg-paper-raised hover:bg-paper flex items-center justify-center text-ink transition"
                aria-label="Notificaciones"
              >
                <Bell className="w-4 h-4" />
              </button>

              <div className="w-[36px] h-[36px] rounded-full bg-brass-soft text-brass font-mono font-bold text-[12.5px] flex items-center justify-center">
                AM
              </div>
            </div>
          </header>

          {/* Main Body */}
          <div className="max-w-[1160px] w-full mx-auto pb-10 flex-1">
            {children}
          </div>

          {/* How It Works Modal */}
          <HowItWorksModal />

          {/* Footer */}
          <footer className="border-t border-line bg-paper-raised/60 py-6 text-xs text-text-muted">
            <div className="max-w-[1160px] mx-auto px-7 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-secondary">CargoMesh v4</span>
                <span>•</span>
                <span>WebMCP Challenge 2026</span>
                <span>•</span>
                <span className="text-brass font-medium">
                  Autonomous Freight Dispatch
                </span>
              </div>
              <div className="flex items-center gap-4 text-text-secondary">
                <Link href="/providers/andes" className="hover:text-ink transition">
                  Andes WebMCP
                </Link>
                <Link href="/exceptions" className="hover:text-ink transition">
                  Excepciones
                </Link>
                <a
                  href="https://github.com/Chujutak2024/cargomesh"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-ink transition flex items-center gap-1 text-brass font-semibold"
                >
                  GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </footer>
        </DemoModeProvider>
      </body>
    </html>
  );
}
