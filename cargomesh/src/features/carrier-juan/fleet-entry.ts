/** Selects only identities already authorized or returned by a scoped read. */
export function fleetEntry(options:{scenario:boolean;requestedCarrier:string|null;requestedService:string|null;carriers:string[];services:string[]}){
 const carrier=options.requestedCarrier&&options.carriers.includes(options.requestedCarrier)?options.requestedCarrier:options.scenario?options.carriers[0]??'':'';
 const service=options.requestedService&&options.services.includes(options.requestedService)?options.requestedService:options.scenario?options.services[0]??'':'';
 return {carrier,service};
}
