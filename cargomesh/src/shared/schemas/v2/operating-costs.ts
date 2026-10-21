import {z} from 'zod';
import {CommercialEvidenceV2Schema} from './commercial';
const rate=z.number().finite().min(0).max(1e8).refine(v=>Math.abs(v*10000-Math.round(v*10000))<0.00001,'Use at most four decimal places.');
const money=z.number().finite().min(0).max(1e8).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001,'Use cents.');
/** Profiles are explicitly assigned to assets. Equipment is a compatibility check, never an inferred tariff. */
export const TruckCostOverridesSchema=z.object({fuelLitresPer100Km:rate.optional(),driverHourlyCost:rate.optional(),vehicleCostPerKm:rate.optional(),fixedCostPerVehicle:money.optional(),maxSpeedKph:rate.refine(v=>v>0&&v<=160).optional()}).strict();
export const TruckCostFleetSchema=z.object({version:z.literal('TRUCK_PROFILES_V1'),profiles:z.array(z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),label:z.string().trim().min(1).max(120),equipmentCode:z.string().min(1).max(100),fuelLitresPer100Km:rate,driverHourlyCost:rate,vehicleCostPerKm:rate,fixedCostPerVehicle:money,maxSpeedKph:rate.refine(v=>v>0&&v<=160)}).strict()).min(1).max(32),assets:z.array(z.object({assetId:z.string().uuid(),profileId:z.string().min(1).max(64),overrides:TruckCostOverridesSchema}).strict()).min(1).max(64)}).strict().refine(f=>new Set(f.profiles.map(p=>p.id)).size===f.profiles.length&&new Set(f.assets.map(a=>a.assetId)).size===f.assets.length&&f.assets.every(a=>f.profiles.some(p=>p.id===a.profileId)),'Unique profiles and explicit asset bindings are required.');
export type TruckCostFleet=z.infer<typeof TruckCostFleetSchema>;
export const CostRouteEndpointsSchema=z.object({origin:z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)}).strict(),destination:z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)}).strict()}).strict();
/** Carrier operating rules, not statutory limits or inferred driver permissions. */
export const CarrierOperatingCostsSchema=z.object({
 fleet:TruckCostFleetSchema.optional(),
 version:z.literal('COST_PLUS_V1'),fuelLitresPer100Km:rate,fuelPricePerLitre:rate,
 driverHourlyCost:rate,vehicleCostPerKm:rate,fixedCostPerVehicle:money,handlingCostPerShipment:money,
 maxContinuousDrivingMinutes:z.number().int().min(1).max(1440),breakMinutes:z.number().int().min(1).max(1440),
 maxDailyDrivingMinutes:z.number().int().min(1).max(1440),dailyRestMinutes:z.number().int().min(1).max(4320),
 payRestTime:z.boolean(),markupPercent:rate.refine(v=>v<=500),taxPercent:rate.refine(v=>v<=100),
}).strict().refine(v=>v.maxDailyDrivingMinutes>=v.maxContinuousDrivingMinutes&&v.dailyRestMinutes>=v.breakMinutes,'Check driving and rest limits.');
export type CarrierOperatingCosts=z.infer<typeof CarrierOperatingCostsSchema>;
/** Explicit driving duration separates wheel time from transit time including stops. */
export const RouteOperatingProfileSchema=z.object({version:z.literal('ROAD_COST_INPUT_V1'),
 endpoints:CostRouteEndpointsSchema.optional(),
 drivingSeconds:z.number().int().positive().max(2592000),tollAmount:money,
 stops:z.array(z.object({waypointIndex:z.number().int().min(0).max(99),afterDrivingSeconds:z.number().int().positive(),restMinutes:z.number().int().positive().max(4320),feeAmount:money}).strict()).max(32),
 source:CommercialEvidenceV2Schema,
}).strict().refine(v=>v.stops.every((s,i)=>s.afterDrivingSeconds<v.drivingSeconds&&(!i||s.afterDrivingSeconds>v.stops[i-1].afterDrivingSeconds))&&new Set(v.stops.map(s=>s.waypointIndex)).size===v.stops.length,'Stops must be ordered, distinct and within the route.');
export type RouteOperatingProfile=z.infer<typeof RouteOperatingProfileSchema>;

const cents=z.number().int().nonnegative().max(1e12);
export const ResourceCostResultSchema=z.object({assetId:z.string().uuid(),assetCode:z.string().max(200).optional(),profileId:z.string().max(64),label:z.string().max(120),equipmentCode:z.string().max(100),operatingCents:cents,litres:z.number().nonnegative(),maxSpeedKph:z.number().positive(),drivingSeconds:z.number().int().positive()}).strict();
export const OperatingCostCalculationSchema=z.object({status:z.literal('READY'),formulaVersion:z.literal('COST_PLUS_V1'),operatingCents:cents,markupCents:cents,taxCents:cents,totalCents:cents,
 resources:z.array(ResourceCostResultSchema).max(8).optional(),
 components:z.array(z.object({code:z.string().max(100),kind:z.enum(['FUEL','TOLL','HANDLING','TRANSPORT','OTHER','TAX']),cents}).strict()).max(20),resourceCount:z.number().int().min(1).max(8),drivingSeconds:z.number().int().positive(),restSeconds:z.number().int().nonnegative(),paidDriverSeconds:z.number().int().positive(),transportSeconds:z.number().int().positive(),restStopCount:z.number().int().nonnegative(),litres:z.number().nonnegative(),provenance:z.enum(['VERIFIED','SIMULATED'])}).strict();
export const CarrierCostCalculationRecordSchema=z.object({offerId:z.string().uuid(),policyVersion:z.number().int().positive(),snapshot:z.object({calculation:OperatingCostCalculationSchema,distanceKm:z.number().positive(),operatingProfile:RouteOperatingProfileSchema,restLocations:z.array(z.object({waypointIndex:z.number().int().nonnegative(),label:z.string().nullable(),city:z.string().nullable()}).strict()).max(100)}).strict().nullable(),parameters:CarrierOperatingCostsSchema.nullable()}).strict();
