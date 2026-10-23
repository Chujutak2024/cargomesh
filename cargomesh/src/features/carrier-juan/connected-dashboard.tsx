'use client';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {ControlTower} from '@/features/carrier-control-tower/control-tower';
import s from './connected-dashboard.module.css';

export function ConnectedDashboard({carrier,refreshToken}:{carrier:CarrierPortalAccessV2;refreshToken:number}){
 return <div className={s.dashboard}>
  <ControlTower embedded dashboard carrier={carrier} refreshToken={refreshToken}/>
 </div>;
}
