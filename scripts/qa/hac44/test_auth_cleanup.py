"""Ownership and nonsecret key backup remain mandatory for Auth cleanup."""
import json
import unittest
from subprocess import CompletedProcess
from unittest.mock import Mock, patch
from auth_cleanup import clean_auth_ids


class AuthCleanupTests(unittest.TestCase):
    def control(self):
        bank=Mock()
        bank.raw_sql.side_effect=[CompletedProcess([],0,'[]',''),CompletedProcess([],0,'[]','')]
        with patch('auth_cleanup.save') as save:
            clean_auth_ids(bank)
            self.assertEqual(save.call_args[0][1]['status'],'PASS')
        return bank

    def test_ownership_failure_prevents_reads_and_deletes(self):
        self.control()
        bank=Mock();bank.own.side_effect=RuntimeError('Foreign marker')
        with self.assertRaisesRegex(RuntimeError,'Foreign marker'):clean_auth_ids(bank)
        bank.raw_sql.assert_not_called()

    def test_nonempty_keyless_or_secret_key_table_aborts(self):
        self.control()
        for keys,message in ((None,'without a reviewed'),(['token'],'Unreviewed')):
            bank=Mock();bank.raw_sql.side_effect=[CompletedProcess([],0,json.dumps([{'table':'auth.future','keys':keys}]),''),CompletedProcess([],0,'1','')]
            with patch('auth_cleanup.save') as save,self.assertRaisesRegex(RuntimeError,message):clean_auth_ids(bank)
            save.assert_not_called()
            self.assertFalse(any('delete ' in str(c).lower() for c in bank.raw_sql.call_args_list))


if __name__=='__main__':unittest.main()
