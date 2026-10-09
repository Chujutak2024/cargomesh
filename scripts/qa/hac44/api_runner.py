import json
import re
import subprocess
import sys
from pathlib import Path

from common import OUT, ROOT, run, write
from local import CLI, HARNESS, LAYOUT, BANK

if __name__ == "__main__":
    schemafiles = [
        p.name
        for p in (ROOT / "cargomesh/src/shared/schemas/v2").glob("*.ts")
        if not p.name.endswith(".test.ts")
    ]
    env = {
        "HAC44_ROOT": str(ROOT).replace("\\", "/"),
        "HAC44_OUT": str(OUT).replace("\\", "/"),
        "HAC44_SCHEMA_FILES": json.dumps(schemafiles),
        "NODE_OPTIONS": "--conditions=react-server",
        "HAC44_HTTP_PORT": str(LAYOUT.app_port),
    }
    if sys.argv[1] != "inventory":
        # Dedicated local stack only; credentials travel in memory to the child, never to a log or file.
        BANK.own("http-tests")
        p = subprocess.run(
            CLI + ["status", "--workdir", str(HARNESS), "--output", "json"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        assert p.returncode == 0
        cfg = json.loads(p.stdout)
        assert cfg["API_URL"] == LAYOUT.api_url
        env.update(
            {
                "NEXT_PUBLIC_SUPABASE_URL": cfg["API_URL"],
                "NEXT_PUBLIC_SUPABASE_ANON_KEY": cfg["ANON_KEY"],
                "HAC44_JWT_SECRET": cfg["JWT_SECRET"],
            }
        )
        fixtures = json.loads(
            (ROOT / "supabase/scenarios/v2-road-baseline/fixtures/hac40-catalog.json").read_text(
                encoding="utf-8"
            )
        )
        for test in [
            "20_v2_hac40_fleet.test.sql",
            "21_v2_hac40_crew.test.sql",
            "22_v2_hac40_workflow.test.sql",
        ]:
            s = (ROOT / "supabase/tests" / test).read_text(encoding="utf-8")
            for m in re.finditer(
                (
                    "insert into (?:fixtures|crew_inputs) values\\('([^']+)',"
                    "'(\\{[^\\n]+?\\})'(?:::jsonb)?\\);"
                ),
                s,
            ):
                fixtures.setdefault(m[1], json.loads(m[2]))
        positive = json.loads(
            (ROOT / "supabase/scenarios/v2-road-baseline/fixtures/positive.json").read_text(
                encoding="utf-8"
            )
        )
        fixtures["requestBody"] = positive["requestBody"]
        fixtures = json.loads(json.dumps(fixtures).replace("c23", "d44"))
        write(
            OUT / "dataset/api-fixtures.json",
            json.dumps(fixtures, ensure_ascii=False, indent=2) + "\n",
        )
    args = [
        "node",
        ROOT / "cargomesh/node_modules/tsx/dist/cli.mjs",
        "--tsconfig",
        ROOT / "cargomesh/tsconfig.json",
        Path(__file__).with_name("api.ts"),
    ]
    if sys.argv[1] == "inventory":
        args += ["--inventory"]
    if sys.argv[1] == "extended":
        args += ["--extended"]
        env["HAC44_LOG_PREFIX"] = "extended-"
    if sys.argv[1] == "ltl":
        args += ["--ltl"]
        env["HAC44_LOG_PREFIX"] = "ltl-"
    if sys.argv[1] == "auth-verify":
        args += ["--auth-verify"]
        env["HAC44_LOG_PREFIX"] = "auth-"
    if sys.argv[1] == "contract":
        args += ["--contract"]
        env["HAC44_LOG_PREFIX"] = "contract-"
    if sys.argv[1] == "contract-read":
        args += ["--contract-read"]
        env["HAC44_LOG_PREFIX"] = "contract-read-"
    if sys.argv[1] == "replay-read":
        args += ["--replay-read"]
        env["HAC44_LOG_PREFIX"] = "replay-"
    if sys.argv[1] == "pending":
        args += ["--pending"]
        env["HAC44_LOG_PREFIX"] = "pending-"
    p = run("api-" + sys.argv[1], args, ROOT / "cargomesh", timeout=1200, env_extra=env)
    sys.exit(p.returncode)
