"use client";
import {ConnectedCarrierWorkspace} from './connected-carrier-workspace';
import {LocalDemoCoordinator} from './local-demo-coordinator';
/** Separate trees: local request hooks never mount in the connected carrier workspace. */
export function ConnectedCoordinator({previewEnabled=false,demoMode=false}:{previewEnabled?:boolean;demoMode?:boolean}) {
  return demoMode&&previewEnabled?<LocalDemoCoordinator/>:<ConnectedCarrierWorkspace previewEnabled={previewEnabled}/>;
}
