import type { Metadata } from "next";
import { CargoEntrance } from "@/features/landing/cargo-entrance";

export const metadata: Metadata = {
  title: "CargoMesh",
  description: "Entra a CargoMesh y coordina tus solicitudes de transporte.",
};

export default function HomePage() {
  return <CargoEntrance />;
}