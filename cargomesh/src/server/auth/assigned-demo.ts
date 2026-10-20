import 'server-only';
import {headers} from 'next/headers';
import {assignedDemoAllowed,type AssignedDemoConfig} from './assigned-demo-policy';
export function assignedDemoConfig():AssignedDemoConfig{return {
 enabled:process.env.CARGOMESH_ASSIGNED_DEMO_ENABLED==='true'&&process.env.CM_ENABLE_DEMO==='1',
 origin:process.env.CARGOMESH_ASSIGNED_DEMO_ORIGIN,secret:process.env.CARGOMESH_ASSIGNED_DEMO_SECRET,
 carrierEmail:process.env.CARGOMESH_DEMO_CARRIER_EMAIL,carrierPassword:process.env.CARGOMESH_DEMO_CARRIER_PASSWORD,
 clientOrganizationId:process.env.CARGOMESH_DEMO_CLIENT_ORGANIZATION_ID,
};}
export async function assignedDemoEnabled(){return assignedDemoAllowed(assignedDemoConfig(),(await headers()).get('host'));}
