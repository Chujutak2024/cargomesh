"""Paired parser controls against the actual UML 07 and current flat dictionary."""
import copy
import json
import unittest
from pathlib import Path

from sources import parse, parse_dictionary

ROOT = Path(__file__).resolve().parents[3]


class DictionaryTests(unittest.TestCase):
    def setUp(self):
        self.official = parse(ROOT / "docs/v2-amazon/diagrams/review-2026-09-24/07-complete-classes-sprint2-reviewed.drawio")
        self.text = (ROOT / "docs/v2-amazon/delivery/HAC27_UML_ATTRIBUTE_DICTIONARY_2026-10-02.md").read_text(encoding="utf-8")
        self.design = json.loads((ROOT / "docs/v2-amazon/models/FULL_MODEL_PHYSICAL_DESIGN.json").read_text(encoding="utf-8"))

    def positive(self):
        classes, relations = parse_dictionary(self.text, self.official, self.design)
        self.assertEqual((len(classes), sum(len(c["attributes"]) for c in classes), len(relations)), (57, 397, 93))
        self.assertEqual(classes[0]["attributes"][3]["uml"], "legalName?: string")
        self.assertEqual(classes[0]["attributes"][0]["representation"], "organizations.id")
        lane = next(c for c in classes if c["name"] == "ServiceLane")
        self.assertIn("kind: DIRECT | WITHIN_AREA", [a["uml"] for a in lane["attributes"]])

    def test_current_dictionary(self):
        self.positive()

    def test_rejects_empty_and_missing_inventory(self):
        self.positive()
        for text in ("", self.text.replace("| Organization | id | UUID |", "| Unknown | id | UUID |"),
                     "\n".join(x for x in self.text.splitlines() if not x.startswith("| Organization | id |"))):
            with self.subTest(text=text[:35]), self.assertRaisesRegex(ValueError, "inventory mismatch|class/attribute mismatch"):
                parse_dictionary(text, self.official, self.design)

    def test_rejects_same_count_attribute_drift(self):
        self.positive()
        for text in (self.text.replace("| Organization | id | UUID |", "| Organization | wrong | UUID |"),
                     self.text.replace("| Organization | legalName | string | True |", "| Organization | legalName | string | False |")):
            with self.subTest(), self.assertRaisesRegex(ValueError, "class/attribute mismatch"):
                parse_dictionary(text, self.official, self.design)

    def test_rejects_relation_loss_and_same_count_drift(self):
        self.positive()
        for change in ("missing", "absent", "duplicate", "cardinality"):
            design = copy.deepcopy(self.design)
            if change == "missing": design["relations"].pop()
            elif change == "absent": del design["relations"]
            elif change == "duplicate": design["relations"][1] = design["relations"][0]
            else: design["relations"][0]["endLabels"] = ["0..*", "0..*"]
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "inventory mismatch|relation mismatch"):
                parse_dictionary(self.text, self.official, design)


if __name__ == "__main__":
    unittest.main()
