"use client";
import { useEffect, useState } from "react";
import { journeySnapshot } from "./journey-model";
const epoch = Date.now();
export function useJourney(id: string, inactive = false) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => { if (!document.hidden) setElapsed((Date.now() - epoch) / 1000); };
    update(); const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return journeySnapshot(id, elapsed, inactive);
}
