import {z} from "zod";
import {CarrierRoleV2Schema} from "./identity";
export const CarrierPortalAccessV2Schema=z.object({carrierId:z.string().uuid(),operatorId:z.string().uuid(),
 role:CarrierRoleV2Schema,carrierName:z.string().min(1),displayName:z.string().min(1)}).strict();
export const CarrierPortalAccessListV2Schema=z.array(CarrierPortalAccessV2Schema);
export type CarrierPortalAccessV2=z.infer<typeof CarrierPortalAccessV2Schema>;
export const CARRIER_WORKSPACE_ENTRY = "/v2-workspace#/fleet" as const;
export const CARRIER_LOGIN_PATH = "/login?returnTo=" + encodeURIComponent(CARRIER_WORKSPACE_ENTRY);
export const LoginReturnToSchema=z.enum(["/carrier-portal","/dashboard","/v2-workspace",CARRIER_WORKSPACE_ENTRY]);
export type LoginReturnTo = z.infer<typeof LoginReturnToSchema>;
export function safeLoginReturnTo(value:unknown){const p=LoginReturnToSchema.safeParse(value);return p.success?p.data:undefined;}
export function loginDestination(preferred:unknown,hasMember:boolean,carriers:CarrierPortalAccessV2[]):string|null{
 const to=safeLoginReturnTo(preferred);
 if(to==="/carrier-portal"||to===CARRIER_WORKSPACE_ENTRY)return carriers.length?CARRIER_WORKSPACE_ENTRY:null;
 if(hasMember)return to??"/dashboard";
 return carriers.length?CARRIER_WORKSPACE_ENTRY:null;
}
