"""Run real local PKCE smoke and reconstruct the owned empty bank afterwards."""
import json
import os
import subprocess
import sys
from pathlib import Path
from common import ROOT, save, safe, write, OUT
from local import BANK, CLI, HARNESS, LAYOUT


def main():
    BANK.own("pkce-smoke")
    env = os.environ.copy()
    env.update(HAC44_ROOT=str(ROOT), HAC44_CLI_JSON=json.dumps(CLI), HAC44_BANK_FOLDER=str(HARNESS),
               HAC44_API_URL=LAYOUT.api_url, HAC44_BANK_DB=BANK.db,
               HAC44_CALLBACK_URL="http://127.0.0.1:" + str(LAYOUT.app_port) + "/oauth/callback")
    result = None
    try:
        process = subprocess.run(["node", Path(__file__).with_suffix(".mjs")], env=env,
                                 capture_output=True, text=True, encoding="utf-8", timeout=180)
        markers = [line for line in process.stdout.splitlines() if line.startswith(("PKCE_FIXTURE:", "PKCE_CLIENT:", "PKCE_RESULT:"))]
        write(OUT / "logs/pkce-smoke-command.log", "COMMAND: node scripts/qa/hac44/pkce_smoke.mjs\n"
              + "\n".join(markers) + "\n" + safe(process.stderr) + "\nEXIT_CODE: " + str(process.returncode) + "\n")
        measured = [json.loads(line.split(":", 1)[1]) for line in markers if line.startswith("PKCE_RESULT:")]
        result = measured[0] if process.returncode == 0 and len(measured) == 1 else {
            "status": "BLOQUEADO", "reason": "Real local PKCE did not complete; see pkce-smoke-command.log"}
    finally:
        # Dedicated empty bank: public/private backups and three ownership proofs
        # precede reset. Auth credentials are deliberately excluded from exports.
        BANK.reset(CLI)
        BANK.own("pkce-after-reset")
        counted = BANK.raw_sql("pkce-auth-cleanup-zero", "select count(*) from auth.users;")
        if counted.returncode or counted.stdout.strip() != "0":
            raise RuntimeError("PKCE Auth cleanup is not zero")
    save("pkce-smoke.json", {**result, "cleanupAuthUsers": 0, "cleanup": "Owned local reset"})
    print(result["status"] + " real local PKCE smoke; owned cleanup 0")
    return 0 if result["status"] == "PASS" else 2


if __name__ == "__main__":
    sys.exit(main())
