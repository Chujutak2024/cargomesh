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

class CarrierDeadlinePresentationTests(unittest.TestCase):
    def test_live_c02_utc_midnight_is_19_in_peru_on_previous_day(self):
        text, limit = carrier_context(context('2026-10-26T00:00:00Z'), NOW)
        self.assertIn('Authoritative response deadline in Peru: 2026-10-25 19:00 PET (America/Lima, UTC-05:00)', text)
        self.assertIn('Same deadline in UTC: 2026-10-26 00:00 UTC', text)
        self.assertNotIn('2026-10-25 17:00', text)
        self.assertEqual(limit, 240)

    def test_live_c01_expiry_retains_exact_hour_and_prohibits_new_offers(self):
        item = context('2026-10-22T23:00:00Z')
        item['temporal']['deadlineState'] = 'EXPIRED'
        text, limit = carrier_context(item, NOW)
        self.assertIn('2026-10-22 18:00 PET', text)
        self.assertIn('2026-10-22 23:00 UTC', text)
        self.assertIn('already passed', text)
        self.assertIn('Do not invite preparing', text)
        self.assertEqual(limit, 240)

    def test_date_boundaries_and_input_offsets_use_the_same_instant(self):
        cases = [
            ('2027-01-01T02:30:00Z', '2026-12-31 21:30 PET', '2027-01-01 02:30 UTC'),
            ('2026-11-01T00:15:00Z', '2026-10-31 19:15 PET', '2026-11-01 00:15 UTC'),
            ('2026-10-25T19:00:00-05:00', '2026-10-25 19:00 PET', '2026-10-26 00:00 UTC'),
        ]
        for deadline, peru, utc in cases:
            with self.subTest(deadline=deadline):
                text, _ = carrier_context(context(deadline), NOW)
                self.assertIn(peru, text)
                self.assertIn(utc, text)

    def test_unknown_or_stale_snapshot_cannot_acquire_an_authoritative_deadline(self):
        for invalid in [None, 'not-a-date', '2026-10-26T00:00:00']:
            text, _ = carrier_context(context(invalid), NOW)
            self.assertIn('deadline is unknown', text)
            self.assertNotIn('Authoritative response deadline in Peru:', text)
            self.assertNotIn('You may explain how', text)
        text, limit = carrier_context(context(), NOW+241)
        self.assertNotIn('Authoritative response deadline in Peru:', text)
        self.assertEqual(limit, 0)

if __name__=='__main__':unittest.main()
