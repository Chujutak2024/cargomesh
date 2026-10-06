"""Portable, local-only HAC-44 evidence helpers; never export credentials."""

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(os.environ.get("HAC44_ROOT", Path(__file__).resolve().parents[3])).resolve()
OUT = Path(
    os.environ.get("HAC44_EVIDENCE", Path(tempfile.gettempdir()) / "hac44-evidence")
).resolve()
assert not OUT.is_relative_to(ROOT), "Evidence/backups must be outside the checkout"
LOGS = OUT / "logs"
LOGS.mkdir(parents=True, exist_ok=True)
BASE = "abba8056825bb4d7170fe8cdf57bfeefa8b73eb1"


def safe(s):
    """Redact credentials before returning or persisting captured output."""
    s = re.sub(
        (
            "(?im)^.*(?:jwt[ _-]?secret|secret key|service[ _-]?role key|anon "
            "key|publishable key|sb_secret_|sb_publishable_|encrypted_password|crypt\\().*"
            "$"
        ),
        "[REDACTED_CREDENTIAL_LINE]",
        s,
    )
    s = re.sub(r"eyJ[\w-]+\.[\w-]+\.[\w-]+", "[REDACTED_JWT]", s)
    s = re.sub(r"sb_(?:secret|publishable)_[\w-]+", "[REDACTED_KEY]", s)
    s = re.sub(r"(postgres(?:ql)?://[^:\s]+:)[^@\s]+@", r"\1[REDACTED]@", s)
    s = re.sub(r"(?i)(Bearer\s+)\S+", r"\1[REDACTED]", s)
    s = re.sub(
        (
            "(?i)([\"\\']?(?:JWT_SECRET|SECRET_KEY|SERVICE_ROLE_KEY|ANON_KEY|password|acces"
            "s_token|refresh_token)[\"\\']?\\s*[:=]\\s*)[^\\n,"
            "}]+"
        ),
        r"\1[REDACTED]",
        s,
    )
    return s


def write(p, s):
    """Write an external artifact and verify its exact contents by rereading it."""
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding="utf-8", newline="\n")
    assert p.read_text(encoding="utf-8") == s


def save(name, obj):
    """Persist a JSON evidence record in the external log directory."""
    write(LOGS / name, json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def run(label, args, cwd=ROOT, data=None, timeout=900, env_extra=None):
    """Run a command with filtered output and persist its command, exit code and duration."""
    args = [str(a) for a in args]
    env = os.environ.copy()
    for k in list(env):
        if any(
            w in k.upper()
            for w in ("SUPABASE", "MCP_", "QA_PASSWORD", "DATABASE_URL", "PGPASSWORD")
        ):
            env.pop(k, None)
    if env_extra:
        env.update(env_extra)
    start = time.monotonic()
    try:
        p = subprocess.run(
            args,
            cwd=cwd,
            input=data,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            env=env,
        )
    except subprocess.TimeoutExpired:
        p = subprocess.CompletedProcess(args, 124, "", "TIMEOUT")
    p.stdout = safe(p.stdout)
    p.stderr = safe(p.stderr)
    write(
        LOGS / (re.sub(r"[^A-Za-z0-9._-]", "-", label) + ".log"),
        "COMMAND: "
        + safe(subprocess.list2cmdline(args))
        + "\nCWD: "
        + str(cwd)
        + "\n"
        + p.stdout
        + p.stderr
        + "\nEXIT_CODE: "
        + str(p.returncode)
        + "\nSECONDS: "
        + str(round(time.monotonic() - start, 2))
        + "\n",
    )
    print(label + ": exit=" + str(p.returncode), flush=True)
    return p


def state():
    """Load the evidence cut or record the selected Git revision for a fresh run."""
    path = LOGS / "cut.json"
    if path.exists():
        obj = json.loads(path.read_text(encoding="utf-8"))
        assert (
            not os.environ.get("HAC44_SOURCE_SHA") or obj["head"] == os.environ["HAC44_SOURCE_SHA"]
        ), "Use a fresh evidence directory for a different SHA"
        return obj
    head = run(
        "source-head", ["git", "rev-parse", os.environ.get("HAC44_SOURCE_SHA", "HEAD")]
    ).stdout.strip()
    obj = {
        "head": head,
        "root": str(ROOT),
        "baseline": BASE,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    save("cut.json", obj)
    return obj
