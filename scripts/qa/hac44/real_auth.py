"""Replace scenario placeholder claims with claims verified by the local issuer."""
import json
import os
import re
import subprocess
import threading
import time
from pathlib import Path

CLAIMS = re.compile(r'(set local\s+"request\.jwt\.claims"\s*=\s*)\'((?:[^\']|\'\')*)\'\s*;', re.I)
_lock = threading.Lock()
_cache = {}


def cached_claims(ids, issue, key, now=None):
    """Serialize OTP issuance; only live, issuer-verified claims enter memory."""
    now=time.time() if now is None else now
    with _lock:
        missing=[i for i in ids if (key,i) not in _cache or _cache[key,i].get('exp',0)<=now+60]
        if missing:
            fresh=issue(missing)
            for i in missing:
                c=fresh[i]
                if c.get('sub')!=i or c.get('role')!='authenticated' or not c.get('session_id') or c.get('exp',0)<=now+60:
                    raise RuntimeError('Live verified issuer claims prerequisite failed')
            for i in missing:_cache[key,i]=fresh[i]
        return {i:_cache[key,i].copy() for i in ids}


def replace_claims(query, issue):
    matches = list(CLAIMS.finditer(query))
    ids = sorted({json.loads(m[2].replace("''", "'"))["sub"] for m in matches})
    issued = issue(ids) if ids else {}
    def substitute(m):
        old = json.loads(m[2].replace("''", "'"))
        claims = issued[old["sub"]]
        if claims.get("sub") != old["sub"] or claims.get("role") != "authenticated" or not claims.get("session_id"):
            raise RuntimeError("Issuer-verified authenticated session prerequisite failed")
        return m[1] + "'" + json.dumps(claims).replace("'", "''") + "';"
    query = CLAIMS.sub(substitute, query)
    # Deferred invariants reach their boundary before any subsequent role change.
    return re.sub(r'\breset role\s*;', 'set constraints all immediate;\nreset role;', query, flags=re.I)


def issued_claims(ids):
    from common import ROOT, OUT
    from local import CLI, LAYOUT
    env = os.environ.copy()
    env.update(HAC44_ROOT=str(ROOT), HAC44_EVIDENCE=str(OUT), HAC44_CLI_JSON=json.dumps(CLI), HAC44_API_URL=LAYOUT.api_url)
    def issue(subjects):
        result = subprocess.run(['node', Path(__file__).with_suffix('.mjs'), json.dumps(subjects)], capture_output=True,
                                encoding='utf-8', env=env, timeout=120)
        if result.returncode:
            raise RuntimeError('Actual Auth claims unavailable; raw child output omitted')
        return json.loads(result.stdout)
    return cached_claims(ids,issue,(str(ROOT),str(OUT),LAYOUT.project_prefix,LAYOUT.api_url))
