"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { getTruckEnvironment } from "../logistics-3d/truck-environment";
import s from "./cargo-entrance.module.css";

export function CargoEntrance() {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    let cancelled = false, dispose: (() => void) | undefined;
    const phase = () => { node.dataset.environment = getTruckEnvironment(new Date()).phase; };
    phase();
    const timer = setInterval(phase, 30000);
    // Loading the renderer never delays the only action or server rendered backdrop.
    void import("./entrance-scene").then(({ mountEntranceScene }) => {
      if (!cancelled) dispose = mountEntranceScene(node);
    }).catch(() => { if (!cancelled) node.dataset.scene = "fallback"; });
    return () => { cancelled = true; clearInterval(timer); dispose?.(); };
  }, []);
  return <main className={s.entrance} aria-label="Entrada a CargoMesh">
    <div ref={stage} className={s.stage} aria-hidden="true" data-scene="loading">
      <div className={s.fallback} />
    </div>
    <div className={s.shade} aria-hidden="true" />
    <Link className={s.enter} href="/v2-workspace#/dashboard" prefetch={false}>Ir a CargoMesh</Link>
  </main>;
}
