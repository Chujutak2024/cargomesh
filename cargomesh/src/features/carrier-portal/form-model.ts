import { z } from "zod";
type Value=unknown;
export function unwrapped(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodEffects) return unwrapped(schema.innerType());
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return unwrapped(schema.unwrap());
  if (schema instanceof z.ZodDefault) return unwrapped(schema.removeDefault());
  return schema;
}
export function emptyInput(schema: z.ZodTypeAny): Value {
  if (schema instanceof z.ZodEffects) return emptyInput(schema.innerType());
  if (schema instanceof z.ZodDefault) return schema._def.defaultValue();
  if (schema instanceof z.ZodNullable) return null;
  if (schema instanceof z.ZodOptional) return undefined;
  const type = unwrapped(schema);
  if (type instanceof z.ZodObject) return Object.fromEntries(Object.entries(type.shape as Record<string,z.ZodTypeAny>)
    .map(([key, field]) => [key, emptyInput(field)]));
  if (type instanceof z.ZodLiteral) return type.value;
  if (type instanceof z.ZodBoolean) return false;
  if (type instanceof z.ZodArray) return [];
  if (type instanceof z.ZodUnion || type instanceof z.ZodDiscriminatedUnion) return emptyInput(type.options[0]);
  if (type instanceof z.ZodTuple) return type.items.map(emptyInput);
  if (type instanceof z.ZodRecord) return {};
  return "";
}

/** The control uses the user's local timezone; API payloads retain an explicit UTC offset. */
export function localDateTime(value:unknown):string {
 if(typeof value!=="string"||!value)return "";
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return "";
 const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return local.toISOString().slice(0,16);
}
export function utcDateTime(value:string):string {
 if(!value)return "";const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toISOString():"";
}

/** Keep writable fields only: persisted output can contain server derived fields. */
export function projectInput(schema:z.ZodTypeAny, value:unknown):unknown {
 if(value==null)return value;
 const type=unwrapped(schema);
 if(type instanceof z.ZodObject && typeof value==="object" && !Array.isArray(value)) {
  const data=value as Record<string,unknown>;
  return Object.fromEntries(Object.entries(type.shape as Record<string,z.ZodTypeAny>).map(([key,child])=>
   [key,key in data?projectInput(child,data[key]):emptyInput(child)]));
 }
 if(type instanceof z.ZodArray && Array.isArray(value))return value.map(v=>projectInput(type.element,v));
 return value;
}
