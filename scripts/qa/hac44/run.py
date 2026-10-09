"""Complete local verification and return the current cut's actual verdict."""

import json
import shutil
import sys
from collections import Counter
from pathlib import Path
from common import OUT, run

ARTIFACTS = {
    ("tests.py",): ["harness-tests.json"],
    ("strict_controls.py",): ["strict-caller-controls.json"],
    ("api_runner.py", "run"): ["api-results.json"],
    ("api_runner.py", "extended"): ["extended-api-results.json"],
    ("api_runner.py", "ltl"): ["ltl-api-results.json"],
    ("api_runner.py", "pending"): ["pending-cases.json"],
    ("api_runner.py", "auth-verify"): ["auth-controls.json"],
    ("api_runner.py", "contract"): ["contract-api-results.json"],
    ("contract_verdict.py",): ["contract-verdict.json"],
    ("rls.py",): ["independent-rls-result.json"],
    ("races.py",): ["independent-races.json"],
    ("fk_coverage.py",): ["independent-fk-pairs.json", "baseline-fk-pairs.json"],
    ("persistence.py",): ["contract-persistence-result.json"],
    ("lifecycle.py", "seed"): ["full-flow-seed-result.json"],
    ("lifecycle.py", "cleanup"): ["full-flow-cleanup-result.json"],
    ("guards.py",): ["local-only-guards.json", "uuid-collision-guard.json"],
    ("pkce_smoke.py",): ["pkce-smoke.json"],
}
CONTRACT_CASES = {
    "contract-required-field-result.json", "contract-route-cardinality-result.json",
    "contract-category-version-result.json", "contract-carrier-isolation-result.json",
    "contract-normalization-result.json",
}


def verdict(states):
    """A missing or blocked measurement cannot become PASS."""
    states = list(states)
    return "FAIL" if "FAIL" in states else "BLOQUEADO" if not states or "BLOQUEADO" in states else "PASS"


def stamp(path):
    return (path.stat().st_mtime_ns, path.read_bytes()) if path.exists() else None


class Runner:
    def __init__(self, out=OUT, execute=None):
        self.out, self.logs = Path(out), Path(out) / "logs"
        self.logs.mkdir(parents=True, exist_ok=True)
        self.execute = execute or run
        self.commands, self.cases, self.completed = [], [], []
        self.stop_requested = False

    def write(self, name, data):
        text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        path = self.logs / name
        path.write_text(text, encoding="utf-8", newline="\n")
        assert path.read_text(encoding="utf-8") == text

    def snapshot(self):
        status = verdict(c["status"] for c in self.commands)
        result = {"status": status, "exit": {"PASS": 0, "FAIL": 1, "BLOQUEADO": 2}[status],
                  "commands": self.commands, "cases": self.cases,
                  "caseCounts": dict(Counter(c["status"] for c in self.cases))}
        self.write("runner-results.json", result)
        return result

    def evidence(self, name, before):
        path = self.logs / name
        if not path.exists() or stamp(path) == before:
            return [{"source": name, "status": "BLOQUEADO", "reason": "Missing fresh case evidence"}]
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            issues = []
            if name == "contract-verdict.json" and {c.get("case") for c in data.get("cases", [])} != CONTRACT_CASES:
                issues.append({"source": name, "status": "BLOQUEADO", "reason": "Incomplete contract case inventory"})
            rows = data if isinstance(data, list) else [data] + data.get("cases", [])
            if not rows or not isinstance(data, (list, dict)) or (isinstance(data, dict) and data.get("cases") == []):
                raise ValueError("No measured cases")
            cases = issues
            for row in rows:
                status = row.get("status")
                if status == "BLOCKED":
                    status = "BLOQUEADO"
                if status == "OBSERVED" and row.get("expected") is None:
                    continue  # Inventory probes are observations, never functional PASS cases.
                if status not in ("PASS", "FAIL", "BLOQUEADO"):
                    cases.append({"source": name, "status": "BLOQUEADO", "reason": "Missing or invalid case verdict"})
                    continue
                cases.append({"source": name, "status": status,
                    **{k: row[k] for k in ("case", "label", "constraint", "method", "path", "http", "expected", "reason") if k in row}})
            if not cases:
                raise ValueError("No functional verdicts")
            return cases
        except (OSError, ValueError, TypeError, AttributeError) as error:
            return [{"source": name, "status": "BLOQUEADO", "reason": str(error)}]

    def child(self, name, *args, blocked=None):
        label = "runner-" + name + "-" + "-".join(args)
        if blocked:
            record = {"script": name, "args": list(args), "exit": None, "status": "BLOQUEADO", "reason": blocked}
        else:
            files = ARTIFACTS.get((name, *args), [])
            previous = {f: stamp(self.logs / f) for f in files}
            result = self.execute(label, [sys.executable, "-X", "utf8", Path(__file__).with_name(name), *args], timeout=1800)
            measured = [case for f in files for case in self.evidence(f, previous[f])]
            self.cases.extend(measured)
            states = [c["status"] for c in measured] if files else ["PASS"]
            if result.returncode:
                states.append("BLOQUEADO" if result.returncode == 2 else "FAIL")
            record = {"script": name, "args": list(args), "exit": result.returncode, "status": verdict(states), "log": label + ".log"}
            for case in measured:
                if case["status"] != "PASS":
                    print(json.dumps(case, ensure_ascii=False), flush=True)
        self.commands.append(record)
        self.snapshot()
        return record

    def cycles(self, blocked=None, seeded=False):
        for cycle in (1, 2):
            first_command, first_case = len(self.commands), len(self.cases)
            ready = blocked
            attempted = not ready
            if not (cycle == 1 and seeded):
                result = self.child("lifecycle.py", "seed", blocked=ready)
                if result["status"] != "PASS":
                    ready = "Seed prerequisite did not pass"
            result = self.child("lifecycle.py", "verify", blocked=ready)
            if result["status"] != "PASS":
                ready = "Dataset verification prerequisite did not pass"
            try:
                for mode in ("run", "extended", "ltl"):
                    self.child("api_runner.py", mode, blocked=ready)
                self.child("pending.py", blocked=ready)
                for mode in ("pending", "auth-verify", "contract"):
                    self.child("api_runner.py", mode, blocked=ready)
                self.child("contract_verdict.py", blocked=ready)
                for name in ("rls.py", "races.py", "fk_coverage.py", "persistence.py"):
                    result = self.child(name, blocked=ready)
                    if name == "fk_coverage.py" and result["exit"] == 3:
                        self.stop_requested = True
                        break
                if not self.stop_requested:
                    self.child("lifecycle.py", "verify", blocked=ready)
                    self.child("matrix.py", blocked=ready)
            finally:
                cleanup = self.child("lifecycle.py", "cleanup", blocked=None if attempted else ready)
            if not self.stop_requested:
                self.child("guards.py", blocked=None if cleanup["status"] == "PASS" else "Cleanup prerequisite did not pass")
            archive = self.out / "cycles" / str(cycle)
            for directory in ("logs", "dataset", "backups"):
                target = archive / directory
                target.mkdir(parents=True, exist_ok=True)
                for source in (self.out / directory).glob("*"):
                    if source.is_file():
                        shutil.copy2(source, target / source.name)
            for source in [*self.out.glob("HAC-44_matriz_*.csv"), *self.out.glob("HAC-44_fk_*.csv")]:
                shutil.copy2(source, archive / source.name)
            records = self.commands[first_command:]
            self.completed.append({"cycle": cycle, "status": verdict(c["status"] for c in records),
                "commands": records, "cases": self.cases[first_case:], "cleanup": cleanup,
                "archive": str(archive.relative_to(self.out))})
            self.write("two-cycles.json", self.completed)
            print(self.completed[-1]["status"] + " complete cycle " + str(cycle), flush=True)
            if self.stop_requested:
                return
            if cleanup["status"] != "PASS":
                blocked = "Previous cleanup did not pass; preserve backup before another seed"

    def all(self):
        blocked = None
        for name, args in [("provenance.py", []), ("tests.py", []), ("gates.py", []), ("runtime.py", ["start"]),
                           ("pkce_smoke.py", []), ("sources.py", []), ("catalog.py", []), ("strict_controls.py", [])]:
            result = self.child(name, *args, blocked=blocked)
            if result["status"] != "PASS":
                blocked = "Setup prerequisite did not pass: " + name
        self.cycles(blocked=blocked)
        if self.stop_requested:
            return self.snapshot()["exit"]
        self.child("generate.py", blocked=blocked)
        self.child("checks.py")
        return self.snapshot()["exit"]


if __name__ == "__main__":
    runner = Runner()
    if sys.argv[1:] and sys.argv[1] == "all":
        try:
            code = runner.all()
        finally:
            stopped = runner.child("runtime.py", "stop")
        sys.exit(code if stopped["status"] == "PASS" else 1)
    if sys.argv[1:] and sys.argv[1] == "cycles":
        runner.cycles(seeded="--seeded" in sys.argv)
        sys.exit(runner.snapshot()["exit"])
    raise SystemExit("Use: python scripts/qa/hac44/run.py all | cycles [--seeded]")
