from datetime import datetime, timezone
import unittest
from carrier_voice_context import carrier_context, carrier_opening

NOW=datetime(2026,10,23,7,tzinfo=timezone.utc).timestamp()
def context(deadline='2026-10-24T23:00:00Z'):
    return {'temporal':{'schemaVersion':'1.0','asOf':'2026-10-23T07:00:00Z','validUntil':'2026-10-23T07:04:00Z',
       'timeZone':'America/Lima','responseDeadline':deadline,'deadlineState':'OPEN',
       'opportunityStatus':'SENT','requestReviewable':True,'mayPrepareOffer':True}}

class CarrierTimeTests(unittest.TestCase):
    def test_open_snapshot_is_advisory_and_uses_peru_time(self):
        text, limit=carrier_context(context(),NOW)
        self.assertIn('2026-10-23T02:00:00-05:00',text)
        self.assertIn('open as of this snapshot',text)
        self.assertIn('not command authorization',text)
        self.assertEqual(limit,240)

    def test_expired_and_exact_boundary_never_suggest_a_new_offer(self):
        for deadline in ['2026-10-22T23:00:00Z','2026-10-23T07:00:00Z']:
            item=context(deadline);item['temporal']['deadlineState']='EXPIRED'
            text,limit=carrier_context(item,NOW)
            self.assertIn('already passed',text)
            self.assertIn('does not cancel an existing booking',text)
            self.assertNotIn('You may explain how',text)

    def test_missing_stale_invalid_and_closed_contexts_never_enable_actions(self):
        for item in [{}, {'temporal':{}}, context()]:
            text,limit=carrier_context(item,NOW+300)
            self.assertIn('unverified',text);self.assertEqual(limit,0)
        for field,value in [('mayPrepareOffer',False),('requestReviewable',False),('opportunityStatus','CANCELLED'),('deadlineState','UNKNOWN')]:
            item=context();item['temporal'][field]=value
            text,_=carrier_context(item,NOW)
            self.assertIn('Do not say the deadline is open',text)

    def test_session_stops_at_deadline_and_opening_does_not_force_an_offer(self):
        item=context('2026-10-23T07:00:10Z');item['temporal']['validUntil']='2026-10-23T07:00:10Z'
        self.assertEqual(carrier_context(item,NOW)[1],10)
        self.assertEqual(carrier_context(item,NOW+10)[1],0)
        self.assertNotIn('prepare an offer',carrier_opening())

if __name__=='__main__':unittest.main()
