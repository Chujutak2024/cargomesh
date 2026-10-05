import json
import re

from common import OUT, save
from local import sql

refs = json.loads((OUT / "dataset/refs.json").read_text(encoding="utf-8"))
b = refs["booking"]["id"]
q = refs["request"]["id"]
query = (
    "begin;set local search_path=extensions,public;select no_plan();\nset "
    "local role authenticated;set local "
    '"request.jwt.claims"=\'{"sub":"d4410000-0000-4000-8000-000000000001",'
    '"role":"authenticated"}\';\nselect is((select count(*)::int from '
    "public.freight_requests where "
    "id='"
    f"{q}"
    "'),1,'positive tenant A reads its persisted request');\nselect "
    "is(jsonb_array_length(public.read_v2_workflow('d4400000-0000-4000-80"
    "00-000000000001','d4420000-0000-4000-8000-000000000001','bookings',"
    '\'{"requestId":null,"carrierId":null,"parentId":null,'
    '"id":"'
    f"{b}"
    "\"}',25,0)),1,'positive A reads booking through real "
    "wrapper');\nselect throws_ok($$select count(*) from "
    "public.v2_bookings$$,'42501',null,'negative A has no direct grant "
    "on commercial table');\nselect ok((select count(*) from "
    "public.cargo_categories)>0,'positive authenticated reference "
    'catalogue accessible\');\nset local "request.jwt.claims"=\'{"sub":"d441'
    '0000-0000-4000-8000-000000000002","role":"authenticated"}\';\nselect '
    "is((select count(*)::int from public.freight_requests where "
    "id='"
    f"{q}"
    "'),0,'negative B cannot read A request through RLS');\nselect "
    "ok((select count(*) from public.facilities where "
    "organization_id='d4400000-0000-4000-8000-000000000002')>0,'positive "
    "B reads its own facilities under same real role');\nselect "
    "is(jsonb_array_length(public.read_v2_workflow('d4400000-0000-4000-80"
    "00-000000000002','d4420000-0000-4000-8000-000000000002','bookings',"
    '\'{"requestId":null,"carrierId":null,"parentId":null,'
    '"id":"'
    f"{b}"
    "\"}',25,0)),0,'negative B cannot read A booking through "
    'wrapper\');\nset local "request.jwt.claims"=\'{"sub":"d4410000-0000-400'
    '0-8000-000000000003","role":"authenticated"}\';\nselect '
    "throws_ok($$select public.read_v2_workflow('d4400000-0000-4000-8000-"
    "000000000001','d4420000-0000-4000-8000-000000000003','bookings',"
    '\'{"requestId":null,"carrierId":null,"parentId":null,'
    '"id":"'
    f"{b}"
    "\"}',25,0)$$,'PT403','FORBIDDEN_WORKFLOW','negative revoked member "
    'cannot use workflow\');\nset local "request.jwt.claims"=\'{"sub":"d4410'
    '000-0000-4000-8000-000000000001","role":"authenticated"}\';\nselect '
    "is(jsonb_array_length(public.read_v2_workflow('d4400000-0000-4000-80"
    "00-000000000001','d4420000-0000-4000-8000-000000000001','bookings',"
    '\'{"requestId":null,"carrierId":null,"parentId":null,'
    '"id":"'
    f"{b}"
    "\"}',25,0)),1,'positive legitimate membership still works after "
    "revoked test');\nreset role;select * from "
    "finish();rollback;"
)
p = sql("independent-rls", query)
bad = len(re.findall(r"(?m)^not ok", p.stdout))
tests = len(re.findall(r"(?m)^ok \d+", p.stdout))
save(
    "independent-rls-result.json",
    {
        "status": "PASS" if p.returncode == 0 and bad == 0 and tests > 0 else "FAIL",
        "exit": p.returncode,
        "tests": tests,
        "failed": bad,
        "role": "authenticated",
        "claims": "synthetic A/B/revoked",
    },
)
assert p.returncode == 0 and bad == 0 and tests > 0
