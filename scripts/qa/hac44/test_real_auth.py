"""Actual Node/tsx ESM import with a paired foreign-fixture rejection."""
import subprocess
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from real_auth import cached_claims, _cache

class ClaimsCacheTests(unittest.TestCase):
    def setUp(self):
        _cache.clear()

    def test_concurrent_queries_share_one_verified_live_session(self):
        calls=[]
        def issue(ids):
            calls.append(ids)
            return {i:{'sub':i,'role':'authenticated','session_id':'verified-local-session','exp':1000} for i in ids}
        with ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda _:cached_claims(['local-user'],issue,'own-bank',now=100),range(16)))
        self.assertEqual(len(calls),1)
        self.assertTrue(all(r['local-user']['session_id']=='verified-local-session' for r in results))
        results[0]['local-user']['role']='foreign'
        self.assertEqual(cached_claims(['local-user'],issue,'own-bank',now=100)['local-user']['role'],'authenticated')

    def test_expiry_and_bank_scope_require_new_verified_issuance(self):
        calls=[]
        def issue(ids):
            calls.append(ids)
            return {i:{'sub':i,'role':'authenticated','session_id':str(len(calls)),'exp':1000+1000*len(calls)} for i in ids}
        cached_claims(['u'],issue,'bank-a',now=100)
        cached_claims(['u'],issue,'bank-b',now=100)
        cached_claims(['u'],issue,'bank-a',now=1990)
        self.assertEqual(len(calls),3)

    def test_unverified_claims_never_enter_cache(self):
        with self.assertRaises(RuntimeError):
            cached_claims(['u'],lambda ids:{'u':{'sub':'other','role':'authenticated','session_id':'s','exp':1000}},'bank',now=100)
        self.assertEqual(_cache,{})

class RealAuthTransportTests(unittest.TestCase):
    def test_dynamic_esm_import_and_foreign_user_rejection(self):
        root=Path(__file__).resolve().parents[3]
        source="""const {pathToFileURL}=require('node:url');const assert=require('node:assert/strict');
(async()=>{const target=process.argv[1];process.argv[1]='harness-import-regression';const m=await import(pathToFileURL(target).href);
assert.equal(typeof m.fixtureSession,'function');
await assert.rejects(m.fixtureSession('foreign-user'));
console.log('PASS dynamic ESM import and fail-closed foreign fixture');})().catch(()=>process.exitCode=1);"""
        result=subprocess.run(['node','--import','tsx','-e',source,str(Path(__file__).with_name('real_auth.mjs'))],
                              cwd=root/'cargomesh',capture_output=True,text=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('PASS dynamic ESM import',result.stdout)

if __name__=='__main__':unittest.main()
