import {handle} from 'hono/vercel';
import {createOfferPreparationsRouter,productionPreparationService} from '@/server/hono/routes/offer-preparations';
import {requireAuthenticatedCarrier} from '@/server/auth/carrier';
export const runtime='nodejs';
const app=createOfferPreparationsRouter({actor:requireAuthenticatedCarrier,service:productionPreparationService});
export const GET=handle(app);
export const POST=handle(app);
