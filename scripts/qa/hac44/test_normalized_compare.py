"""Protect normalized comparison from hiding real field, shape or ordering changes."""

import contextlib
import csv
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import normalized_compare as comparison


class NormalizedComparisonTests(unittest.TestCase):
    """Every rejection shares a successful four-matrix comparison control."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.baseline, self.current = root / "before", root / "after"
        self.baseline.mkdir()
        self.current.mkdir()
        self.header = ["id", "estado", "evidence", "count"]
        self.before = [
            [
                "d4410000-0000-4000-8000-000000000001",
                "COMPLETO",
                "HAC44_1791223296879 2026-10-05T17:00:50.684313+00:00 " + "a" * 40,
                "17",
            ],
            ["stable-row", "PARCIAL", "Unchanged case and whitespace", "29"],
        ]
        self.after = [
            [
                "d4410000-0000-4000-8000-000000000002",
                "COMPLETO",
                "HAC44_1791227238857 2026-10-05T18:06:33.915787Z " + "b" * 64,
                "17",
            ],
            self.before[1].copy(),
        ]
        for filename in comparison.MATRICES.values():
            self.write(self.baseline / filename, self.header, self.before)
            self.write(self.current / filename, self.header, self.after)

    @staticmethod
    def write(path, header, rows):
        with path.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.writer(stream)
            writer.writerow(header)
            writer.writerows(rows)

    def compare(self):
        with (
            patch.object(comparison, "OUT", self.current),
            patch.object(comparison, "save"),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            return comparison.compare_matrices(self.baseline)

    def positive_control(self):
        result = self.compare()
        self.assertEqual(result["status"], "PASS")
        self.assertTrue(all(matrix["identicalRows"] == 2 for matrix in result["matrices"]))

    def test_real_fields_are_never_dropped(self):
        self.positive_control()
        filename = next(iter(comparison.MATRICES.values()))
        for column, changed in [(1, "DIVERGENTE"), (2, "Other evidence"), (3, "18")]:
            with self.subTest(column=column):
                rows = [row.copy() for row in self.after]
                rows[0][column] = changed
                self.write(self.current / filename, self.header, rows)
                with self.assertRaises(AssertionError):
                    self.compare()
                self.write(self.current / filename, self.header, self.after)
                self.positive_control()

    def test_shape_and_row_order_are_exact(self):
        self.positive_control()
        filename = next(iter(comparison.MATRICES.values()))
        for rows in [self.after[:1], list(reversed(self.after))]:
            with self.subTest(rows=rows):
                self.write(self.current / filename, self.header, rows)
                with self.assertRaises(AssertionError):
                    self.compare()
                self.write(self.current / filename, self.header, self.after)
                self.positive_control()
        self.write(self.current / filename, [*self.header, "extra"], self.after)
        with self.assertRaises(AssertionError):
            self.compare()

    def test_normalization_does_not_ignore_whitespace_or_case(self):
        self.positive_control()
        for changed in ["unchanged case and whitespace", "Unchanged  case and whitespace"]:
            filename = next(iter(comparison.MATRICES.values()))
            rows = [row.copy() for row in self.after]
            rows[1][2] = changed
            self.write(self.current / filename, self.header, rows)
            with self.assertRaises(AssertionError):
                self.compare()
            self.write(self.current / filename, self.header, self.after)
            self.positive_control()


if __name__ == "__main__":
    unittest.main()
