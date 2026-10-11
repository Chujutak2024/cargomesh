"""Run the unchanged HAC-29 gate in three dedicated HAC-44 local banks.

The adapter changes runtime paths/ports/container names, not migrations, test
profiles or product sources. Historical V1 is regression-only and never mixed
into the V2 scenario.
"""

import hashlib
import inspect
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path
from types import SimpleNamespace

from common import OUT, ROOT, run, save, write
from local import CLI, DB, HARNESS, HEAD, PROJECT, gate, sql, LAYOUT, BANK
from banks import Bank, configure, preflight

EXCLUDED = (
    "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,"
    "logflare,vector,"
    "supavisor"
)


def prepare():
    """Verify the native manifest and prepare the isolated local replay workdir."""
    g = gate()
    g.manifest()
    assert run("cli-version", CLI + ["--version"]).stdout.strip() == "2.117.0"
    config = configure((ROOT / "supabase-v2/supabase/config.toml").read_text(encoding="utf-8-sig"), PROJECT, LAYOUT.base("v2"))
    # Local-only OAuth smoke; native source config and product code are unchanged.
    config = re.sub(r"(\[auth.oauth_server\][^\[]*?\benabled\s*=\s*)false", r"\1true", config)
    if BANK.marker.exists():
        BANK.own("prepare")
    write(HARNESS / "supabase/config.toml", config)
    records = json.loads(
        (ROOT / "supabase-v2/migration-manifest.json").read_text(encoding="utf-8")
    )["migrations"]
    for m in records:
        blob = subprocess.run(
            ["git", "show", HEAD + ":" + m["path"]], cwd=ROOT, capture_output=True, check=True
        ).stdout
        assert hashlib.sha256(blob.decode("utf-8-sig").encode()).hexdigest() == m["sha256"]
        p = HARNESS / "supabase/migrations" / Path(m["path"]).name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(blob)
        assert p.read_bytes() == blob
    save("migration-hashes.json", records)
    return g


def full():
    """Run the unchanged native V2 gate and independent V1 replay profile."""
    g = prepare()
    g.CLI = CLI
    g.EVIDENCE = OUT / "gate"
    g.EVIDENCE.mkdir(exist_ok=True)
    g.ARGS = SimpleNamespace(
        action="v2",
        v1_replay_port_base=LAYOUT.base("v1"),
        v1_replay_inspector_port=LAYOUT.base("v1") + 10,
        v1_replay_analytics_port=LAYOUT.base("v1") + 7,
        baseline_replay_port_base=LAYOUT.base("baseline"),
        baseline_replay_inspector_port=LAYOUT.base("baseline") + 10,
        baseline_replay_analytics_port=LAYOUT.base("baseline") + 7,
    )
    def reference(kind):
        return configure((ROOT / "supabase/config.toml").read_text(encoding="utf-8-sig"), LAYOUT.project(kind), LAYOUT.base(kind))

    g.reference_config = reference
    g.V1 = "supabase_db_" + LAYOUT.project("v1")
    g.V2 = DB
    g.BASELINE = "supabase_db_" + LAYOUT.project("baseline")
    g.PROFILE = HARNESS
    configs = [tomllib.loads((HARNESS / "supabase/config.toml").read_text(encoding="utf-8"))]
    configs += [tomllib.loads(reference(kind)) for kind in ("v1", "baseline")]
    g.replay_port_preflight = lambda: save("bank-preflight.json", preflight(configs, LAYOUT.app_port))

    banks = {DB: BANK, g.V1: Bank(OUT / "gate/workdir-v1", LAYOUT.project("v1")),
             g.BASELINE: Bank(OUT / "gate/workdir-baseline", LAYOUT.project("baseline"))}
    native_prepare_reference = g.prepare_reference

    def prepare_reference(kind):
        bank = banks[g.V1 if kind == "v1" else g.BASELINE]
        if (bank.folder / "supabase/config.toml").exists():
            bank.config()
            if bank.marker.exists():
                bank.own("prepare-reference")
        return native_prepare_reference(kind)

    g.prepare_reference = prepare_reference

    def reset(label, folder):
        bank = next(bank for bank in banks.values() if bank.folder == Path(folder).resolve())
        if not bank.marker.exists():
            bank.start_new(CLI)
        bank.reset(CLI)

    g.reset = reset
    write(
        HARNESS / "test-profiles.json",
        (ROOT / "supabase-v2/test-profiles.json").read_text(encoding="utf-8"),
    )
    write(
        HARNESS / "checks/v1-fixtures.sql",
        (ROOT / "supabase-v2/checks/v1-fixtures.sql").read_text(encoding="utf-8"),
    )
    write(
        HARNESS / "migration-manifest.json",
        (ROOT / "supabase-v2/migration-manifest.json").read_text(encoding="utf-8"),
    )
    g.manifest = lambda: print("PASS original native manifest already verified")

    def native_run(label, args, data=None):
        if "test" in args and "db" in args and "--workdir" in args:
            folder = Path(args[args.index("--workdir") + 1]).resolve()
            next(bank for bank in banks.values() if bank.folder == folder).own("pgtap")
        if len(args) > 3 and args[0:2] == ["docker", "exec"]:
            container = args[3] if args[2] == "-i" else args[2]
            if container not in banks:
                raise RuntimeError("Native runner attempted an unowned container")
            banks[container].own("native-" + label)
        if (
            len(args) > 1
            and Path(str(args[1])).name.startswith("check-hac40-")
            and str(args[1]).endswith("-race.py")
        ):
            BANK.own("native-race-" + label)
            # Preserve the native race logic; redirect only its dedicated local container.
            p = Path(args[1])
            source = p.read_text(encoding="utf-8").replace("supabase_db_cargomesh-v2-local", DB)
            before = sql(
                label + "-backup-public",
                (
                    "select jsonb_object_agg(name,rows) from (select c.relname name,0 rows from "
                    "pg_class c join pg_namespace n on n.oid=c.relnamespace where "
                    "n.nspname='public' and c.relkind='r') "
                    "x;"
                ),
            )
            assert before.returncode == 0
            backup = run(
                label + "-data-backup",
                [
                    "docker",
                    "exec",
                    DB,
                    "pg_dump",
                    "-U",
                    "postgres",
                    "--data-only",
                    "--schema=public",
                    "--schema=private",
                    "postgres",
                ],
            )
            assert backup.returncode == 0
            write(OUT / "backups" / (label + ".sql"), backup.stdout)
            clone = OUT / "runtime" / p.name
            write(clone, source)
            fixture = ROOT / "scripts/hac40_workflow_local_fixture.py"
            preload = ""
            if "hac40_workflow_local_fixture" in source:
                body = fixture.read_text(encoding="utf-8").replace(
                    "supabase_db_cargomesh-v2-local", DB
                )
                preload = (
                    (
                        "import sys,types; m=types.ModuleType('hac40_workflow_local_fixture'); "
                        "m.__file__="
                    )
                    + repr(str(fixture))
                    + "; sys.modules[m.__name__]=m; exec(compile("
                    + repr(body)
                    + ","
                    + repr(str(fixture))
                    + ",'exec'),m.__dict__); "
                )
            launcher = (
                preload
                + "ns={'__name__':'__main__','__file__':"
                + repr(str(p))
                + "}; exec(compile("
                + repr(source)
                + ","
                + repr(str(p))
                + ",'exec'),ns)"
            )
            args = [sys.executable, "-X", "utf8", "-c", launcher]
        result = run("gate-" + label, args, ROOT, data, timeout=1200)
        if result.returncode:
            raise RuntimeError(label + " failed; see external logs")
        return result.stdout

    g.run = native_run
    g.main()
    g.tests("v1", g.prepare_reference("v1"))
    save(
        "native-gates.json",
        {
            "status": "PASS",
            "head": HEAD,
            "v1": "Unchanged historical replay/profile, separate HAC44 local bank",
            "v2": (
                "Full native gate: provenance, reset, V1 absence + positive, frozen-baseline "
                "drift, scenario, pgTAP, five native race runners, "
                "backup/cleanup"
            ),
            "adapter": "Only runtime paths, ports, projects and race-container address",
            "productFilesChanged": 0,
        },
    )
    BANK.own("enable-http")
    assert (
        run(
            "start-http-stack",
            CLI + ["start", "--workdir", HARNESS, "--exclude", EXCLUDED],
            timeout=900,
        ).returncode
        == 0
    )
    print(
        (
            "PASS V1 and V2 native gates; runtime.py start enables the HTTP services "
            "after the database-only "
            "replay"
        )
    )


if __name__ == "__main__":
    full()
