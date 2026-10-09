"""Use only named HAC-44 local Docker banks; no connection URL is accepted."""

import hashlib
import importlib.util
import os
import re
import shutil
import socket
import tomllib
from pathlib import Path

from common import OUT, ROOT, run, safe, save, state, write
from banks import Bank, Layout

HEAD = state()["head"]
HARNESS = OUT / "stack-v2"
LAYOUT = Layout.environment()
PROJECT = LAYOUT.project("v2")
DB = "supabase_db_" + PROJECT
BANK = Bank(HARNESS, PROJECT)
cli = os.environ.get("HAC44_CLI") or shutil.which("supabase")
CLI = [cli] if cli else ["npx.cmd" if os.name == "nt" else "npx", "--yes", "supabase@2.117.0"]


def gate():
    """Load the unchanged native gate module from the selected checkout."""
    spec = importlib.util.spec_from_file_location("hac29_gate", ROOT / "supabase-v2/gate.py")
    g = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(g)
    return g


def sql(label, query, persist=True):
    """Execute SQL only through the dedicated HAC-44 local Docker database."""
    BANK.own("sql")
    if persist:
        write(OUT / "repro/sql" / (label + ".sql"), safe(query))
    return run(
        label,
        [
            "docker",
            "exec",
            "-i",
            DB,
            "psql",
            "-X",
            "-A",
            "-t",
            "-v",
            "ON_ERROR_STOP=1",
            "-v",
            "local_only=1",
            "-U",
            "postgres",
            "-d",
            "postgres",
        ],
        ROOT,
        query,
    )


def script(label, path, backup=False):
    """Expand local SQL includes and execute the selected scenario script."""
    p = Path(path)
    p = p if p.is_absolute() else ROOT / p
    raw = p.read_text(encoding="utf-8-sig")
    save(
        label + "-source.json",
        {
            "head": HEAD,
            "path": str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p),
            "sha256": hashlib.sha256(raw.encode()).hexdigest(),
        },
    )

    def expand(file):
        source = file.read_text(encoding="utf-8-sig")
        return re.sub(
            r"^\\ir (.+)$",
            lambda m: expand((file.parent / m[1].strip()).resolve()),
            source,
            flags=re.M,
        )

    return sql(label, ("\\set backup_confirmed 1\n" if backup else "") + expand(p), persist=False)
