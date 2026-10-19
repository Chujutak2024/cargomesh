"""Pure regression checks for the local CI fixture adapter; no DB or AWS calls."""
import unittest
from hac40_workflow_local_fixture import ROOT, fixture_setup_sql, fixture_record_ids

class FixtureAdapterTests(unittest.TestCase):
 def test_current_fixture_has_no_pgtap_assertions_but_keeps_native_response(self):
  source=(ROOT/'supabase/tests/22_v2_hac40_workflow.test.sql').read_text(encoding='utf-8')
  self.assertIn('select throws_ok(',source)
  setup=fixture_setup_sql(source)
  for assertion in ('select no_plan(', 'select ok(', 'select is(', 'select throws_ok('):
   self.assertNotIn(assertion,setup)
  self.assertIn("insert into refs values('response',public.command_v2_carrier_workflow",setup)
  self.assertIn("select pg_temp.save('booking'",setup)
  self.assertNotIn("select pg_temp.save('hold'",setup)

 def test_indented_assertion_is_excluded_without_removing_setup(self):
  self.assertEqual(fixture_setup_sql("select 1;\n  select throws_ok('x');\nselect pg_temp.save('hold', 'x');"),'select 1;')

 def test_cleanup_uses_direct_record_ids_and_ignores_command_envelopes(self):
  refs={'opportunity':{'id':'opportunity-id'},'response':{'record':{'id':'opportunity-id'},'replay':False},
        'key':{'id':'receipt-id'},'alias':{'id':'opportunity-id'},'empty':None}
  self.assertEqual(fixture_record_ids(refs),['opportunity-id','receipt-id'])

if __name__=='__main__':unittest.main()
