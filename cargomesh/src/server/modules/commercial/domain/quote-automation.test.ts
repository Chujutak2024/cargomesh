import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QuotePolicyValueSchema,QuoteSearchInputSchema} from '@/shared/schemas/v2/quote-automation';
import {calculateCarrierTariff,recommendedQuoteOptions} from './quote-automation';
import {quoteHistoryScript} from './quote-history';
const policy=QuotePolicyValueSchema.parse({schemaVersion:'2.0',serviceId:'c2360000-0000-4000-8000-000000000001',laneId:'c2380000-0000-4000-8000-000000000001',active:true,autoIssue:true,basis:'PER_KM',baseAmount:100,ratePerKm:1.25,minimumAmount:200,fuelAmount:10.01,tollAmount:2,handlingAmount:0,taxAmount:0,validityMinutes:60,confirmationMinutes:30,validUntil:'2030-01-01T00:00:00Z',terms:'Synthetic carrier-approved tariff',provenanceStatus:'SIMULATED',acknowledgeAuthority:true});
test('tariff requires sourced distance and rounds each money component to cents',()=>{
 assert.equal(calculateCarrierTariff(policy,null),null);assert.equal(calculateCarrierTariff(policy,NaN),null);
 assert.deepEqual(calculateCarrierTariff(policy,100),{transportCents:22500,totalCents:23701});
 assert.deepEqual(calculateCarrierTariff(policy,1),{transportCents:20000,totalCents:21201});
});
test('trip policy rejects an ambiguous rate, fractions of cents, and unapproved authority',()=>{
 assert.equal(QuotePolicyValueSchema.safeParse({...policy,basis:'PER_TRIP'}).success,false);
 assert.equal(QuotePolicyValueSchema.safeParse({...policy,baseAmount:0.001}).success,false);
 assert.equal(QuotePolicyValueSchema.safeParse({...policy,acknowledgeAuthority:false}).success,false);
});
test('presentation truncates ranked alternatives without changing their source order',()=>{
 const all=[{position:1},{position:2},{position:3},{position:4}];assert.deepEqual(recommendedQuoteOptions(all),all.slice(0,3));assert.equal(all.length,4);
});
test('no historical requests or prices never produce a fabricated price',()=>{
 assert.match(quoteHistoryScript([]),/Do not invent/);
 assert.match(quoteHistoryScript([{requestId:policy.serviceId,reference:'REQ-TEST',createdAt:'2026-01-01T00:00:00Z',totalWeightKg:100,totalVolumeM3:1,quotedPrices:[]}]),/none have a recorded carrier price/);
});
test('past prices are labelled as historical and cannot authorize a booking',()=>{
 const text=quoteHistoryScript([{requestId:policy.serviceId,reference:'REQ-TEST',createdAt:'2026-01-01T00:00:00Z',totalWeightKg:100,totalVolumeM3:1,quotedPrices:[{amount:500,currency:'USD',issuedAt:'2026-01-01T00:00:00Z',status:'RECEIVED',basis:'HISTORICAL_QUOTE_NOT_CURRENT_PRICE'}]}]);
 assert.match(text,/USD 500.00/);assert.match(text,/not current offers/);assert.match(text,/explicit client authorization/);
});
test('search requires an explicit version, deadline and consent',()=>{
 assert.equal(QuoteSearchInputSchema.safeParse({schemaVersion:'2.0',expectedDraftVersion:1,responseDeadline:'2030-01-01T00:00:00Z'}).success,false);
});

test('multi-resource pricing needs explicit scope and applies it without hidden multiplication',()=>{const p=QuotePolicyValueSchema.parse({...policy});assert.equal(calculateCarrierTariff(p,100,2),null);assert.equal(calculateCarrierTariff({...p,maxResources:2,resourcePricing:'PER_PLAN'},100,2)?.totalCents,calculateCarrierTariff(p,100)?.totalCents);assert.equal(calculateCarrierTariff({...p,maxResources:2,resourcePricing:'PER_RESOURCE'},100,2)?.totalCents,2*calculateCarrierTariff(p,100)!.totalCents);});
