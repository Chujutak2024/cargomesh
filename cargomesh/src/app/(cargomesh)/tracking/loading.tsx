import { Truck } from "lucide-react";
import s from "@/features/shipper-portal/tracking-experience.module.css";

export default function TrackingLoading() {
  return <div className={s.page} role="status" aria-busy="true"><div className={s.loadingHero}><Truck size={24} aria-hidden="true"/><span>Loading tracking / Cargando seguimiento…</span></div><div className={s.loadingCard}/><div className={s.loadingCard}/></div>;
}
