"use client";

import {TruckReferenceStill} from '@/features/logistics-3d/truck-reference-still';
import {fleetReferencePhoto} from './fleet-photos';
import type {FleetVehicle} from './fleet-model';
import {fleetCardIdentity} from './fleet-card-identity';
import s from './fleet.module.css';

/** A stable image in the directory; interactive 3D remains in the vehicle record. */
export function FleetTruckPreview({vehicle}:{vehicle:FleetVehicle}){
  const designId=vehicle.visual?.designId,photo=fleetReferencePhoto(vehicle);
  return (
    <div className={s.directoryPreview}>
      <TruckReferenceStill designId={designId} photo={vehicle.photoDataUrl} fallback={photo.src} position={photo.position} alt={fleetCardIdentity(vehicle).title}/>
    </div>
  );
}
