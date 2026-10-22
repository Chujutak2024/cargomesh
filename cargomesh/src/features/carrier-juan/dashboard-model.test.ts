import test from 'node:test';
import assert from 'node:assert/strict';
import {carrierDashboard} from './dashboard-model';
import {booking,offer,fixture,id} from '@/features/carrier-portal/commercial-test-fixtures';
const now=Date.parse('2026-10-21T18:00:00Z');
function confirmed(date='2026-10-21T12:00:00Z') {const b=booking();b.status='CONFIRMED';b.data.carrierConfirmationStatus='CONFIRMED';b.data.confirmedAt=date;return b;}

test('dashboard does not treat quotes, pending authorizations or cancelled bookings as contracted money',()=>{
 const s=fixture();assert.equal(carrierDashboard(s,'USD',7,now).contractedCents,0);
 s.bookings=[booking()];assert.equal(carrierDashboard(s,'USD',7,now).contractedCents,0);
 s.bookings=[confirmed()];assert.equal(carrierDashboard(s,'USD',7,now).contractedCents,10000);
 s.bookings[0].data.authorizationStatus='REVOKED';assert.equal(carrierDashboard(s,'USD',7,now).contractedCents,0);
});
test('daily graph and period comparison use persisted confirmation instants and Peru day boundaries',()=>{
 const s=fixture(),old=offer(90),b=confirmed('2026-10-11T12:00:00Z');b.id=id(91);b.data.offerId=old.id;
 s.offers.push(old);s.bookings=[confirmed('2026-10-21T02:00:00Z'),b];
 const m=carrierDashboard(s,'USD',7,now);assert.equal(m.buckets.find(x=>x.date==='2026-10-20')?.cents,10000);assert.equal(m.previousCents,10000);assert.equal(m.changePercent,0);
});
test('duplicate offer references do not double financial amounts; missing relationships remain incomplete',()=>{
 const s=fixture(),a=confirmed(),b={...confirmed(),id:id(99)};s.bookings=[a,b];assert.equal(carrierDashboard(s,'USD',7,now).contractedCents,10000);
 a.data.offerId=id(98);s.bookings=[a];const m=carrierDashboard(s,'USD',7,now);assert.equal(m.complete,false);assert.equal(m.estimatedMarginCents,null);
});
test('missing cost snapshots are unknown margin, never invented profit',()=>{
 const s=fixture();s.bookings=[confirmed()];assert.equal(carrierDashboard(s,'USD',7,now).estimatedMarginCents,null);
 const m=carrierDashboard(s,'USD',7,now,{[offer().id]:{offerId:id(94),snapshot:{calculation:{totalCents:10000,operatingCents:1000}}}});assert.equal(m.estimatedMarginCents,null);
 s.bookings[0].data.confirmedAt=null;assert.equal(carrierDashboard(s,'USD',7,now).complete,false);
});
