"""Measure actual cookie sessions on an owned seeded bank; reset after evidence."""
import json
import sys
from pathlib import Path
from common import OUT, ROOT, run, save
from lifecycle import seed
from local import BANK, CLI

def main():
    BANK.own("authentication-suite")
    cases = []
    result = None
    try:
        seed()
        result = run("authentication-http", [sys.executable, "-X", "utf8",
            Path(__file__).with_name("api_runner.py"), "authentication"], timeout=300)
        path = OUT / "logs/authentication-authentication-cases.json"
        if path.exists():
            cases = json.loads(path.read_text(encoding="utf-8"))
        if not cases or result.returncode:
            cases.append({"case": "actual-cookie-session-fixture", "status": "BLOQUEADO",
                          "reason": "Actual local cookie session did not complete"})
    finally:
        # Same ownership proofs/backups as PKCE, with no Auth credentials exported.
        BANK.reset(CLI)
        BANK.own("authentication-after-reset")
        counted = BANK.raw_sql("authentication-auth-cleanup-zero", "select count(*) from auth.users;")
        if counted.returncode or counted.stdout.strip() != "0":
            raise RuntimeError("Actual-session Auth cleanup is not zero")
    status = "FAIL" if any(row["status"] == "FAIL" for row in cases) else "BLOQUEADO" if any(row["status"] != "PASS" for row in cases) else "PASS"
    save("authentication-result.json", {"status": status, "cases": cases,
         "cleanupAuthUsers": 0, "cleanup": "Owned reset after public/private backup", "credentialsPersisted": False})
    return 1 if status == "FAIL" else 2 if status == "BLOQUEADO" else 0

if __name__ == "__main__":
    sys.exit(main())
