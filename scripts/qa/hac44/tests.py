"""Run discovered harness suites and preserve actual command results externally."""

import sys

from common import ROOT, run, save


def main():
    commands = [
        ("qa-python-tests", [sys.executable, "-m", "unittest", "discover", "-s",
                             "scripts/qa/hac44", "-p", "test_*.py"], ROOT),
        ("qa-http-tests", ["node", "--conditions=react-server", "--import", "tsx", "--test",
                           ROOT / "scripts/qa/hac44/http_contract.test.ts",
                           ROOT / "scripts/qa/hac44/http_pending.test.ts",
                           ROOT / "scripts/qa/hac44/http_oracles.test.ts"], ROOT / "cargomesh"),
    ]
    cases = []
    for label, args, cwd in commands:
        result = run(label, args, cwd=cwd)
        cases.append({"case": label, "status": "PASS" if result.returncode == 0 else "FAIL",
                      "exit": result.returncode, "log": label + ".log"})
    status = "PASS" if all(c["status"] == "PASS" for c in cases) else "FAIL"
    save("harness-tests.json", {"status": status, "cases": cases})
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
