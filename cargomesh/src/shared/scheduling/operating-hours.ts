import {z} from 'zod';

// Narrow schema port from HAC-51. No request planning or Carrier depot behavior.
export const IanaTimeZoneSchema=z.string().min(1).refine(zone=>{
  try{new Intl.DateTimeFormat('en',{timeZone:zone});return !/^[+-]/.test(zone);}catch{return false;}
},'A valid IANA timezone is required.');
const Opening=z.object({
  dayOfWeek:z.number().int().min(1).max(7),
  opensAt:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closesAt:z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/),
}).strict().refine(v=>v.opensAt<v.closesAt,'Split overnight opening into daily intervals.');
export const OperatingHoursSchema=z.object({timezone:IanaTimeZoneSchema,weekly:z.array(Opening).max(28)})
  .strict().superRefine((value,ctx)=>{
    const sorted=[...value.weekly].sort((a,b)=>a.dayOfWeek-b.dayOfWeek||a.opensAt.localeCompare(b.opensAt));
    for(let i=1;i<sorted.length;i++)if(sorted[i].dayOfWeek===sorted[i-1].dayOfWeek&&sorted[i].opensAt<sorted[i-1].closesAt)
      ctx.addIssue({code:'custom',message:'Opening intervals must not overlap.'});
  });
