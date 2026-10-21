import {z} from 'zod';
import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
const Allocation=z.object({id:z.string().uuid(),window:TimeWindowV2Schema,allocationSummary:z.object({role:z.enum(['LOAD_BEARING','AUXILIARY']),equipment:z.string().min(1),units:z.array(z.object({unitIndex:z.number().int().nonnegative(),quantity:z.number().int().positive(),weightKg:z.number().positive(),volumeM3:z.number().positive()}).strict())}).strict()});
/** Render only the allowlisted summary, never opaque resource snapshots. */
export function opportunityAllocations(row:Opportunity){return row.data.assignmentSnapshots.flatMap(snapshot=>{const parsed=Allocation.safeParse(snapshot);return parsed.success?[parsed.data]:[];});}
