import {z} from "zod";
import {CarrierRoleV2Schema} from "./identity";
export const CarrierPortalAccessV2Schema=z.object({carrierId:z.string().uuid(),operatorId:z.string().uuid(),
 role:CarrierRoleV2Schema,carrierName:z.string().min(1),displayName:z.string().min(1)}).strict();
export const CarrierPortalAccessListV2Schema=z.array(CarrierPortalAccessV2Schema);
export type CarrierPortalAccessV2=z.infer<typeof CarrierPortalAccessV2Schema>;
export const LoginReturnToSchema=z.enum(["/carrier-portal","/dashboard","/v2-workspace"]);
export function safeLoginReturnTo(value:unknown){const p=LoginReturnToSchema.safeParse(value);return p.success?p.data:undefined;}
export function loginDestination(preferred:unknown,hasMember:boolean,carriers:CarrierPortalAccessV2[]):string|null{
 const to=safeLoginReturnTo(preferred);
 if(to==="/carrier-portal")return carriers.length?to:null;
 if(hasMember)return to??"/dashboard";
 return carriers.length?"/carrier-portal":null;
}
