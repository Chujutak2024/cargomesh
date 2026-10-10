"""Ownership failures prevent mutations; each negative includes a valid control."""

import json
import socket
import tempfile
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

from banks import Bank, BankAbort, Layout, configure, excluded_ranges, preflight


class BankTests(unittest.TestCase):
    def control(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        folder = Path(temp.name).resolve()
        (folder / "supabase").mkdir()
        (folder / "supabase/config.toml").write_text('project_id="own-test"\n[db]\nport=64002\n', encoding="utf-8")
        marker = {"project": "own-test", "folder": str(folder), "id": "d4400000-0000-4000-8000-000000000001"}
        (folder / "ownership.json").write_text(json.dumps(marker), encoding="utf-8")
        calls = []

        def execute(label, args, **kwargs):
            calls.append(args)
            output = ""
            if args[0:3] == ["docker", "ps", "-a"]:
                output = "container-id\n" if len(args) > 4 else ""
            elif args[0:2] == ["docker", "inspect"]:
                output = json.dumps({"id": "container-id", "project": "own-test", "name": "/supabase_db_own-test"}) + "\n"
            elif args[0:2] == ["docker", "exec"]:
                output = marker["id"] + "\n"
            return CompletedProcess(args, 0, output, "")

        bank = Bank(folder, "own-test", execute)
        with patch("banks.save"):
            self.assertEqual(bank.own("positive"), marker)
        calls.clear()
        return bank, marker, calls

    def test_foreign_config_aborts_stop_and_reset_without_mutation(self):
        bank, _, calls = self.control()
        (bank.folder / "supabase/config.toml").write_text('project_id="foreign"', encoding="utf-8")
        for action in (bank.stop, bank.reset):
            with self.assertRaisesRegex(BankAbort, "Foreign project"):
                action(["supabase"])
        self.assertEqual(calls, [])

    def test_missing_marker_aborts_stop_and_reset_without_mutation(self):
        bank, _, calls = self.control()
        bank.marker.unlink()
        for action in (bank.stop, bank.reset):
            with self.assertRaisesRegex(BankAbort, "Missing own bank marker"):
                action(["supabase"])
        self.assertEqual(calls, [])

    def test_foreign_labels_and_database_marker_abort(self):
        for fault in ("labels", "database-marker"):
            bank, _, calls = self.control()
            if fault == "labels":
                bad = [{"id": "container-id", "project": "foreign", "name": "/" + bank.db}]
                context = patch.object(bank, "resources", return_value=bad)
            else:
                context = patch.object(bank, "raw_sql", return_value=CompletedProcess([], 0, "foreign\n", ""))
            with context, self.assertRaises(BankAbort):
                bank.stop(["supabase"])
            self.assertFalse(any(args[0] == "supabase" for args in calls))

    def test_free_occupied_and_reserved_port_controls(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        config = {"project_id": "own-test", "db": {"port": port}}
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            listener.bind(("127.0.0.1", 0))
            app = listener.getsockname()[1]
        self.assertEqual(preflight([config], app, excluded=[])["status"], "PASS")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            listener.bind(("0.0.0.0", port))
            listener.listen(1)
            with self.assertRaisesRegex(BankAbort, "Occupied TCP"):
                preflight([config], app, excluded=[])
        self.assertEqual(preflight([config], app, excluded=[])["status"], "PASS")
        with self.assertRaisesRegex(BankAbort, "Reserved TCP"):
            preflight([config], app, excluded=[(port, port)])

    def test_preexisting_volume_aborts_first_start(self):
        bank, _, calls = self.control()
        bank.marker.unlink()
        original = bank.execute

        def execute(label, args, **kwargs):
            if args[0:3] == ["docker", "ps", "-a"]:
                return CompletedProcess(args, 0, "", "")
            if args[0:3] == ["docker", "volume", "ls"]:
                return CompletedProcess(args, 0, "supabase_db_own-test\n", "")
            return original(label, args, **kwargs)

        bank.execute = execute
        with self.assertRaisesRegex(BankAbort, "Pre-existing project volume"):
            bank.start_new(["supabase"])
        self.assertFalse(any(args[0] == "supabase" for args in calls))

    def test_concurrent_ownership_checks_have_distinct_evidence_files(self):
        bank, marker, _ = self.control()
        original, labels, saved = bank.execute, [], []

        def execute(label, args, **kwargs):
            labels.append(label)
            return original(label, args, **kwargs)

        bank.execute = execute
        with patch("banks.save", side_effect=lambda name, value: saved.append(name)):
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda _: bank.own("sql"), range(8)))
        self.assertTrue(all(result == marker for result in results))
        self.assertEqual(len(labels), len(set(labels)))
        self.assertEqual(len(saved), len(set(saved)))

    def test_configure_all_ports_and_project_from_settings(self):
        source = (Path(__file__).resolve().parents[3] / "supabase-v2/supabase/config.toml").read_text(encoding="utf-8-sig")
        layout = Layout("own-test", 64000)
        rendered = configure(source, layout.project("v2"), layout.base("v2"))
        self.assertIn('project_id = "own-test-v2"', rendered)
        self.assertNotIn("5832", rendered.replace("#", "#"))
        self.assertIn("inspector_port = 64010", rendered)
        self.assertEqual(excluded_ranges(" 50000 50059 *\n 56903 57002\n"), [(50000, 50059), (56903, 57002)])
        with self.assertRaises(BankAbort):
            configure(rendered + "\n[unreviewed]\nport=9999\n", "own-test", 64000)


if __name__ == "__main__":
    unittest.main()
