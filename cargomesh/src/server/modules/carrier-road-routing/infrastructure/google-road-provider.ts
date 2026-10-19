import { calculateRoadRoutes } from '@/server/maps/road-routing';
import { V2DraftError } from '../../freight-requests/application/draft-service';
import type { CoveredRoadProvider } from '../application/carrier-road-service';

/** Bounded process-local protection, not a distributed production quota. */
export function createCoveredRoadProvider(config:{apiKey?:string;fetcher?:typeof fetch;now?:()=>number}):CoveredRoadProvider {
  let calls:{carrierId:string;at:number}[]=[];
  return async input=>{
    if(!config.apiKey?.trim())throw new V2DraftError('ROUTES_NOT_CONFIGURED','Server routing credential is not configured.',503);
    const now=(config.now??Date.now)();calls=calls.filter(c=>now-c.at<60000);
    if(calls.length>=30||calls.filter(c=>c.carrierId===input.carrierId).length>=10)
      throw new V2DraftError('ROUTING_RATE_LIMITED','Local routing budget reached; retry later.',429);
    calls.push({carrierId:input.carrierId,at:now});
    return calculateRoadRoutes({...input,apiKey:config.apiKey,fetcher:config.fetcher});
  };
}

/** Both Carrier endpoints share the same process-local paid-call budget. */
export const coveredRoadProvider = createCoveredRoadProvider({ apiKey: process.env.GOOGLE_ROUTES_API_KEY });
