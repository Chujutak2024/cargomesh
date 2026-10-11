"""Measure identity fields and routes with real local sessions, then reset own bank."""
import json,sys
from pathlib import Path
from common import ROOT,OUT,run,save
from local import BANK,CLI,LAYOUT
from lifecycle import seed

def main():
    BANK.own("identity-evidence")
    result=None
    try:
        seed()
        result=run("identity-business-http",["node",ROOT/"cargomesh/node_modules/tsx/dist/cli.mjs","--tsconfig",ROOT/"cargomesh/tsconfig.json",Path(__file__).with_name("identity_evidence.mts")],cwd=ROOT/"cargomesh",timeout=600,env_extra={"NODE_OPTIONS":"--conditions=react-server","HAC44_ROOT":str(ROOT),"HAC44_EVIDENCE":str(OUT),"HAC44_CLI_JSON":json.dumps(CLI),"HAC44_API_URL":LAYOUT.api_url,"HAC44_HTTP_PORT":str(LAYOUT.app_port),"HAC44_BANK_DB":BANK.db})
    finally:
        BANK.reset(CLI)
        counts=BANK.raw_sql("identity-cleanup-zero","select jsonb_build_object('auth',(select count(*) from auth.users),'organizations',(select count(*) from public.organizations),'carriers',(select count(*) from public.carriers));")
        if counts.returncode or any(json.loads(counts.stdout).values()):
            raise RuntimeError("Identity fixture cleanup is not zero")
        save("identity-cleanup.json",{"status":"PASS","counts":json.loads(counts.stdout),"ownedReset":True})
    return result.returncode if result else 1

if __name__=="__main__":
    sys.exit(main())
