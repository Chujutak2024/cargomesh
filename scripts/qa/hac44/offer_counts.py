"""Owned, read-only physical offer counts; no commercial SELECT grant is assumed."""
import json
import sys
from uuid import UUID, uuid4
from local import sql

if __name__ == "__main__":
    opportunity = str(UUID(sys.argv[1]))
    result = sql("manual-offer-count-" + str(uuid4()),
        "select jsonb_build_object('count',count(*),'ids',coalesce(jsonb_agg(id order by id),'[]'::jsonb)) "
        "from public.v2_carrier_offers where parent_id='" + opportunity + "'::uuid;")
    if result.returncode:
        raise RuntimeError("Owned physical offer count failed")
    measured = json.loads(result.stdout)
    assert measured["count"] == len(measured["ids"])
    print("HAC44_OFFER_COUNT:" + json.dumps(measured))
