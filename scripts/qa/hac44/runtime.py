"""Start HTTP services after the native database-only gate, preserving local volumes."""

import json
import subprocess
import sys
import tomllib

from common import OUT, run
from gates import EXCLUDED
from local import CLI, HARNESS, PROJECT


def start():
    """Start loopback HTTP services while preserving the dedicated database volume."""
    config = tomllib.loads((HARNESS / "supabase/config.toml").read_text(encoding="utf-8-sig"))
    assert config["project_id"] == PROJECT and config["api"]["port"] == 42321
    # CLI start regards an existing database-only bank as already started.
    assert run("http-stop-preserve", CLI + ["stop", "--workdir", HARNESS]).returncode == 0
    assert (
        run(
            "http-start", CLI + ["start", "--workdir", HARNESS, "--exclude", EXCLUDED], timeout=900
        ).returncode
        == 0
    )
    p = subprocess.run(
        CLI + ["status", "--workdir", str(HARNESS), "--output", "json"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert p.returncode == 0 and json.loads(p.stdout)["API_URL"] == "http://127.0.0.1:42321"
    print("PASS dedicated local HTTP stack; volume preserved")


def stop():
    """Stop only verified HAC-44 projects and preserve their local volumes."""
    for path, project in [
        (HARNESS, PROJECT),
        (OUT / "gate/workdir-v1", "hac44-full-flow-v1"),
        (OUT / "gate/workdir-baseline", "hac44-full-flow-baseline"),
    ]:
        if path.joinpath("supabase/config.toml").exists():
            config = tomllib.loads(
                path.joinpath("supabase/config.toml").read_text(encoding="utf-8-sig")
            )
            assert config["project_id"] == project
            assert run("stop-" + project, CLI + ["stop", "--workdir", path]).returncode == 0


if __name__ == "__main__":
    {"start": start, "stop": stop}[sys.argv[1]]()
