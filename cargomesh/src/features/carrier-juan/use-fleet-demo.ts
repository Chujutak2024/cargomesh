"use client";

import { useEffect, useState } from "react";
import { createFleetDemo, decodeFleetDemo, FLEET_DEMO_STORAGE_KEY } from "./fleet-demo";
import type {FleetVehicle} from "./fleet-model";

/** This key holds only simulated assignments, never a freight draft or service record. */
export function useFleetDemo(vehicles?:FleetVehicle[],inventoryReady=true) {
  const [demo, setDemo] = useState(createFleetDemo), [ready, setReady] = useState(false), [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    if(!inventoryReady)return;
    try { const raw=localStorage.getItem(FLEET_DEMO_STORAGE_KEY),restored = decodeFleetDemo(raw,vehicles); if (restored) setDemo(restored);else if(raw)setStorageAvailable(false);else setDemo(createFleetDemo(vehicles)); }
    catch { setStorageAvailable(false); }
    setReady(true);
  }, [inventoryReady,vehicles]);
  useEffect(() => {
    if (!ready||!storageAvailable) return;
    try { localStorage.setItem(FLEET_DEMO_STORAGE_KEY, JSON.stringify(demo)); }
    catch { setStorageAvailable(false); }
  }, [demo, ready,storageAvailable]);
  return { demo, setDemo, ready, storageAvailable };
}
