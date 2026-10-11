"""HAC-44 carrier-only fixtures in one ownership-checked local bank.

Reuse HAC-44 bank, SQL include, evidence and exact-key teardown primitives.
Local Auth administration is the only credential consumer; values never enter
command arguments or captured logs. Manual-login credentials have a separate,
explicit external destination and are never part of evidence/backups.
"""

import argparse
import json
import os
import re
import secrets
import base64
import hashlib
import shutil
import subprocess
import sys
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).with_name("hac44")))
from common import OUT, ROOT, run, save, write
from local import BANK, CLI, DB, HARNESS, HEAD, LAYOUT, script, sql
from banks import configure, preflight

SCENARIO = ROOT / "supabase/scenarios/v2-carrier-portal-qa"
EXCLUDED = "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"


def prepare():
    from gates import prepare as native_prepare
    native_prepare()
    config = tomllib.loads((HARNESS / "supabase/config.toml").read_text(encoding="utf-8"))
    configured = list(__import__("banks").ports(config).values()) + [LAYOUT.app_port]
    if not all(48000 <= port <= 48999 for port in configured):
        raise RuntimeError("Carrier portal bank must remain in the authorized 48000-48999 range")
    save("carrier-bank-preflight.json", preflight([config], LAYOUT.app_port))
    BANK.start_new(CLI)
    BANK.stop(CLI)
    p = run("carrier-http-start", CLI + ["start", "--workdir", HARNESS, "--exclude", EXCLUDED])
    if p.returncode:
        raise RuntimeError("Owned HTTP stack failed; preserve evidence")
    BANK.own("http-start")
    print("PASS owned LOCAL_ONLY bank initialized")


def seed():
    templates = {}
    for source in ["hac40-catalog.json", "hac40-fleet.json", "hac40-crew.json"]:
        templates.update(json.loads((ROOT / "supabase/scenarios/v2-road-baseline/fixtures" / source).read_text()))
    templates["request"] = json.loads((ROOT / "supabase/scenarios/v2-road-baseline/fixtures/positive.json").read_text())["requestBody"]
    before = "create temporary table cp_templates(kind text primary key,value jsonb); grant all on cp_templates to authenticated;\n"
    for kind, value in templates.items():
        before += "insert into cp_templates values('" + kind + "','" + json.dumps(value).replace("'", "''") + "');\n"
    def expand(path):
        return re.sub(r"^\\ir (.+)$", lambda m: expand((path.parent / m[1].strip()).resolve()),
                      path.read_text(encoding="utf-8-sig"), flags=re.M)
    p = sql("carrier-seed", before + expand(SCENARIO / "seed.sql"), persist=False)
    if p.returncode:
        raise RuntimeError("Seed failed; transactional rollback, see filtered log")
    inventory()


def inventory():
    p = sql("carrier-inventory", "select jsonb_build_object('refs',(select jsonb_object_agg(name,value) from carrier_portal_qa.refs where run_id=hac44_qa.current_run()),'actors',(select jsonb_agg(to_jsonb(a) order by ordinal) from carrier_portal_qa.actors a where run_id=hac44_qa.current_run()),'counts',carrier_portal_qa.counts());")
    if p.returncode:
        raise RuntimeError("Cannot capture exact fixture inventory")
    write(OUT / "dataset/carrier-refs.json", json.dumps(json.loads(p.stdout), indent=2) + "\n")


def verify():
    p = script("carrier-verify", SCENARIO / "verify.sql")
    if p.returncode:
        raise RuntimeError("Fixture verification failed")
    inventory()


def local_keys():
    BANK.own("local-auth-admin")
    p = subprocess.run([str(x) for x in CLI + ["status", "--workdir", HARNESS, "--output", "json"]],
                       capture_output=True, encoding="utf-8")
    if p.returncode:
        raise RuntimeError("Cannot read local stack configuration; output suppressed")
    cfg = json.loads(p.stdout)
    if cfg["API_URL"] != LAYOUT.api_url or not cfg["API_URL"].startswith("http://127.0.0.1:"):
        raise RuntimeError("Foreign Auth endpoint")
    return cfg


def auth_request(cfg, path, data, admin=False):
    key = cfg["SERVICE_ROLE_KEY"] if admin else cfg["ANON_KEY"]
    request = urllib.request.Request(cfg["API_URL"] + "/auth/v1/" + path, data=json.dumps(data).encode(),
        headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="PUT" if admin else "POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError("Local Auth operation failed, HTTP " + str(error.code) + "; credential response suppressed") from None


def provision(destination=None):
    if destination:
        target = Path(destination).resolve()
        if target.is_relative_to(ROOT) or target.is_relative_to(OUT):
            raise RuntimeError("Manual credentials must be outside repository AND evidence")
        if target.exists():
            raise RuntimeError("Do not overwrite an existing credential file")
    cfg = local_keys()
    inventory()
    actors = json.loads((OUT / "dataset/carrier-refs.json").read_text())["actors"]
    credentials, sessions = [], {}
    for actor in actors:
        value = secrets.token_urlsafe(32)
        auth_request(cfg, "admin/users/" + actor["auth_user_id"], {"password": value}, admin=True)
        session = auth_request(cfg, "token?grant_type=password", {"email": actor["email"], "password": value})
        if session["user"]["id"] != actor["auth_user_id"]:
            raise RuntimeError("Local session principal mismatch")
        credentials.append({"actor": actor["name"], "email": actor["email"], "password": value})
        sessions[actor["name"]] = session
    if destination:
        write(target, json.dumps(credentials, indent=2) + "\n")
        print("PASS random manual credentials written to the separate external destination; values suppressed")
    save("carrier-real-auth.json", {"actors": len(actors), "verifiedPrincipalIds": [a["auth_user_id"] for a in actors],
                                  "mechanism": "Actual local Auth password session; no persisted sessions or signing secrets"})
    return cfg, sessions


def http():
    cfg, sessions = provision()
    env = {"NEXT_PUBLIC_SUPABASE_URL": cfg["API_URL"], "NEXT_PUBLIC_SUPABASE_ANON_KEY": cfg["ANON_KEY"],
           "CP_SESSIONS": json.dumps(sessions), "CP_OUT": str(OUT), "CP_PORT": str(LAYOUT.app_port),
           "NODE_OPTIONS": "--conditions=react-server"}
    p = run("carrier-functional-http", ["node", "--conditions=react-server", "--import", "tsx",
             ROOT / "scripts/qa/carrier_portal_http.ts"], cwd=ROOT / "cargomesh", env_extra=env)
    # RLS controls use claims decoded from these actual Auth sessions and keep
    # the real invoker role authenticated through both observations.
    actors = json.loads((OUT / "dataset/carrier-refs.json").read_text())["actors"]
    by_name = {a["name"]: a for a in actors}
    rls = "begin;\n"
    for name, foreign in [("c1-operator", "c2-operator"), ("c2-operator", "c1-operator")]:
        encoded = sessions[name]["access_token"].split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        selected = {key: claims[key] for key in ["sub", "role", "aud", "session_id"] if key in claims}
        rls += "set local role authenticated; set local \"request.jwt.claims\"='" + json.dumps(selected).replace("'", "''") + "';\n"
        rls += "select jsonb_build_object('actor','" + name + "','role',current_user,'own', (select count(*) from public.carrier_operators where id='" + by_name[name]["operator_id"] + "'),'foreign',(select count(*) from public.carrier_operators where id='" + by_name[foreign]["operator_id"] + "')); reset role;\n"
    rls += "rollback;\n"
    measured = sql("carrier-real-session-rls", rls)
    records = [json.loads(line) for line in measured.stdout.splitlines() if line.startswith("{")]
    rls_pass = measured.returncode == 0 and len(records) == 2 and all(
        row["role"] == "authenticated" and row["own"] == 1 and row["foreign"] == 0 for row in records)
    save("carrier-real-session-rls.json", {"controls": records, "pass": rls_pass})
    capture_auth()
    inventory()
    if p.returncode:
        raise RuntimeError("HTTP harness failed; see filtered evidence, cleanup remains mandatory")
    if not rls_pass:
        raise RuntimeError("Real authenticated RLS paired controls failed")


def capture_auth():
    query = """
select hac44_qa.capture_ids();
insert into hac44_qa.ids select hac44_qa.current_run(),'auth.users',jsonb_build_object('id',u.id)
from auth.users u join carrier_portal_qa.actors a on a.auth_user_id=u.id and a.run_id=hac44_qa.current_run() on conflict do nothing;
insert into hac44_qa.ids select hac44_qa.current_run(),'auth.identities',jsonb_build_object('id',i.id)
from auth.identities i join carrier_portal_qa.actors a on a.auth_user_id=i.user_id and a.run_id=hac44_qa.current_run() on conflict do nothing;
insert into hac44_qa.ids select hac44_qa.current_run(),'auth.sessions',jsonb_build_object('id',s.id)
from auth.sessions s join carrier_portal_qa.actors a on a.auth_user_id=s.user_id and a.run_id=hac44_qa.current_run() on conflict do nothing;
insert into hac44_qa.ids select hac44_qa.current_run(),'auth.refresh_tokens',jsonb_build_object('id',t.id)
from auth.refresh_tokens t join carrier_portal_qa.actors a on a.auth_user_id::text=t.user_id and a.run_id=hac44_qa.current_run() on conflict do nothing;
insert into hac44_qa.ids select hac44_qa.current_run(),'auth.mfa_amr_claims',jsonb_build_object('id',amr.id)
from auth.mfa_amr_claims amr join auth.sessions s on s.id=amr.session_id
join carrier_portal_qa.actors a on a.auth_user_id=s.user_id and a.run_id=hac44_qa.current_run() on conflict do nothing;
insert into hac44_qa.ids select hac44_qa.current_run(),'auth.audit_log_entries',jsonb_build_object('id',l.id)
from auth.audit_log_entries l join carrier_portal_qa.actors a on
(a.auth_user_id::text=l.payload->>'actor_id' or a.auth_user_id::text=l.payload#>>'{traits,user_id}')
and a.run_id=hac44_qa.current_run() on conflict do nothing;
select jsonb_agg(jsonb_build_object('relation',relation,'key',key) order by relation,key)
from hac44_qa.ids where run_id=hac44_qa.current_run();
"""
    p = sql("carrier-exact-ids", query)
    if p.returncode:
        raise RuntimeError("Cannot register exact local Auth/business IDs")
    rows = json.loads([line for line in p.stdout.splitlines() if line.startswith("[")][-1])
    save("carrier-exact-ids.json", rows)


def cleanup():
    BANK.own("carrier-cleanup")
    capture_auth()
    inventory()
    p = run("carrier-business-backup", ["docker", "exec", DB, "pg_dump", "-U", "postgres", "--data-only",
        "--schema=public", "--schema=private", "--schema=hac44_qa", "--schema=carrier_portal_qa", "postgres"])
    if p.returncode:
        raise RuntimeError("Backup failed; no deletion authorized")
    write(OUT / "backups/carrier-business.sql", p.stdout)
    # Auth backups contain only explicit PKs/user references. Never copy a hash,
    # refresh material, bearer token, MFA secret or full Auth record.
    p = sql("carrier-auth-safe-backup", "select jsonb_build_object('keys',(select jsonb_agg(jsonb_build_object('relation',relation,'key',key)) from hac44_qa.ids where run_id=hac44_qa.current_run() and relation like 'auth.%'),'users',(select jsonb_agg(jsonb_build_object('id',auth_user_id,'email',email,'fixture','LOCAL_ONLY_AUTH_PLACEHOLDER')) from carrier_portal_qa.actors where run_id=hac44_qa.current_run()),'triggers',(select jsonb_agg(to_jsonb(t)) from hac44_qa.triggers t where run_id=hac44_qa.current_run()));")
    if p.returncode:
        raise RuntimeError("Credential-free Auth/trigger backup failed")
    write(OUT / "backups/carrier-auth-and-triggers.json", p.stdout)
    p = script("carrier-cleanup", SCENARIO / "cleanup.sql", backup=True)
    if p.returncode:
        raise RuntimeError("Cleanup rolled back; preserve exact IDs and backup")
    p = script("carrier-zero-counts", SCENARIO / "counts.sql")
    if p.returncode:
        raise RuntimeError("Final counts failed")
    print("PASS exact-ID cleanup; business/Auth/session counts zero; trigger states restored")


def pgtap():
    BANK.own("carrier-pgtap")
    p = script("carrier-gate-exact-registry", ROOT / "supabase/scenarios/v2-full-flow-qa/control.sql")
    if p.returncode:
        raise RuntimeError("Cannot create the gate's independent exact-ID registry")
    p = script("carrier-road-baseline-for-gate", ROOT / "supabase/scenarios/v2-road-baseline/seed.sql")
    if p.returncode:
        raise RuntimeError("Gate prerequisite baseline failed")
    # Baseline users are an unchanged pgTAP prerequisite, never portal actors.
    p = sql("carrier-gate-auth-registry", """
insert into carrier_portal_qa.actors(run_id,ordinal,name,auth_user_id,email,role,identity_status,verified,grant_state)
select hac44_qa.current_run(),n,'gate-'||n,u.id,email,'OWNER','ACTIVE',false,'BASELINE_ONLY'
from auth.users u join (values(1,'c2310000-0000-4000-8000-000000000001'::uuid),
(2,'c2310000-0000-4000-8000-000000000002'::uuid)) a(n,id) on u.id=a.id;
""")
    if p.returncode:
        raise RuntimeError("Cannot register exact baseline Auth IDs")
    capture_auth()
    suites = json.loads((ROOT / "supabase-v2/test-profiles.json").read_text())["v2"]
    p = run("carrier-v2-pgtap", CLI + ["test", "db", "--local", "--workdir", HARNESS] + [ROOT / x for x in suites])
    save("carrier-v2-gate.json", {"exit": p.returncode, "suites": suites, "sourceSHA": HEAD,
                                "scenarioInCheckout": str(SCENARIO.relative_to(ROOT))})
    cleanup()
    if p.returncode:
        raise RuntimeError("Unchanged V2 pgTAP gate failed")


def cycles():
    label = os.environ.get("HAC44_CARRIER_CYCLE_SET", "current")
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", label):
        raise RuntimeError("Invalid cycle evidence label")
    cycle_root = OUT / "cycles" / label
    if cycle_root.exists():
        raise RuntimeError("Preserve previous evidence; choose a new HAC44_CARRIER_CYCLE_SET")
    aggregate = []
    for number in [1, 2]:
        phases = {"cycle": number, "sourceSHA": HEAD, "fixtureHashes": {
            str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(SCENARIO.glob("*")) if path.is_file()}}
        try:
            seed()
            verify()
            shutil.copyfile(OUT / "dataset/carrier-refs.json", OUT / ("cycle-" + str(number) + "-seed-inventory.json"))
            phases["seedVerify"] = "PASS"
            try:
                http()
                phases["functionalContracts"] = "PASS"
            except RuntimeError as error:
                phases["functionalContracts"] = "FAIL"
                phases["observedFailure"] = str(error)
        finally:
            cleanup()
            phases["cleanup"] = "PASS"
            snapshot = cycle_root / str(number)
            shutil.copytree(OUT / "logs", snapshot / "logs")
            shutil.copytree(OUT / "backups", snapshot / "backups")
            shutil.copytree(OUT / "dataset", snapshot / "dataset")
            summary = json.loads((OUT / "logs/carrier-http-summary.json").read_text())
            phases["HTTP"] = summary
            phases["triggerStatesRestored"] = True
            write(snapshot / "result.json", json.dumps(phases, indent=2) + "\n")
            aggregate.append(phases)
        cases = json.loads((snapshot / "logs/carrier-http-cases.json").read_text())
        if summary["blocked"] or any(row.get("failureKind") == "NEW_FAILURE" for row in cases):
            save("carrier-two-cycles.json", aggregate)
            raise RuntimeError("Stopped after mandatory cleanup: new failure or prerequisite blocker; no CP-2")
    save("carrier-two-cycles.json", aggregate)
    if any(row["functionalContracts"] != "PASS" for row in aggregate):
        raise RuntimeError("Two cycles completed and cleaned; product contract failures retained")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "seed", "verify", "http", "cleanup", "inventory", "manual-login", "pgtap", "cycles", "stop"])
    parser.add_argument("--credentials-file")
    args = parser.parse_args()
    if args.action == "manual-login":
        if not args.credentials_file:
            parser.error("manual-login requires --credentials-file outside repo/evidence")
        provision(args.credentials_file)
    elif args.action == "stop":
        BANK.stop(CLI)
    else:
        globals()[args.action]()
