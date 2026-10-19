"use client";
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {JuanCarrierWorkspace} from '@/features/carrier-juan/coordinator';
/** Juan's preserved presentation; connected APIs and Pipeline remain separate. */
export function ConnectedCoordinator({previewEnabled=false,initialAccess}:{previewEnabled?:boolean;demoMode?:boolean;initialAccess?:CarrierPortalAccessV2[]}){
 return <JuanCarrierWorkspace previewEnabled={previewEnabled} initialAccess={initialAccess}/>;
}
