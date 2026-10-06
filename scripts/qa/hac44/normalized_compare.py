"""Compare every CSV cell with only the checkpoint's authorized volatile normalization."""

import csv
import os
import re
from pathlib import Path

from common import OUT, save

VOLATILE = re.compile(
    r"(?P<timestamp>\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
    r"(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})\b)"
    r"|(?P<uuid>\b[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\b)"
    r"|(?P<sha>\b[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?\b)"
    r"|(?P<epoch>(?<!\d)\d{13}(?!\d))"
)
MATRICES = {
    "classes": "HAC-44_matriz_clases.csv",
    "attributes": "HAC-44_matriz_atributos.csv",
    "relations": "HAC-44_matriz_relaciones.csv",
    "endpoints": "HAC-44_matriz_endpoints.csv",
}


def normalize_cell(value):
    """Replace only ISO timestamps, UUIDs, SHA hashes and thirteen-digit epoch values."""
    return VOLATILE.sub(lambda match: "<" + match.lastgroup.upper() + ">", value)


def read_matrix(path):
    """Read a CSV without dropping, sorting or changing any column or row."""
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        header, rows = reader.fieldnames, list(reader)
        assert header and len(header) == len(set(header)), "Invalid or duplicate CSV headers"
        assert all(
            set(row) == set(header) and all(isinstance(value, str) for value in row.values())
            for row in rows
        ), "CSV row width differs from its header"
        return header, rows


def compare_matrices(baseline):
    """Require all four matrix headers, rows and normalized cells to match CP-2."""
    results = []
    differences = []
    for name, filename in MATRICES.items():
        old_header, before = read_matrix(baseline / filename)
        new_header, after = read_matrix(OUT / filename)
        headers_equal = old_header == new_header
        if not headers_equal:
            differences.append({"matrix": name, "kind": "header"})
        if len(before) != len(after):
            differences.append({"matrix": name, "kind": "row_count"})
        identical = 0
        for number, (old, new) in enumerate(zip(before, after), 1):
            row_equal = headers_equal
            if headers_equal:
                for column in old_header:
                    if normalize_cell(old[column]) != normalize_cell(new[column]):
                        row_equal = False
                        differences.append({"matrix": name, "row": number, "column": column})
            identical += int(row_equal)
        results.append(
            {
                "matrix": name,
                "file": filename,
                "identicalRows": identical,
                "baselineRows": len(before),
                "currentRows": len(after),
                "headersIdentical": headers_equal,
            }
        )
    result = {
        "status": "PASS" if not differences else "FAIL",
        "baseline": str(baseline),
        "normalization": "Only epoch-ms (13 digits), ISO-8601 timestamps, UUID and SHA",
        "allColumnsCompared": True,
        "rowOrderPreserved": True,
        "matrices": results,
        "differences": differences,
    }
    save("normalized-cp2-comparison.json", result)
    assert not differences, "Normalized matrix differences: " + str(differences[:12])
    for matrix in results:
        print(
            "PASS "
            + matrix["matrix"]
            + ": "
            + str(matrix["identicalRows"])
            + "/"
            + str(matrix["baselineRows"])
            + " rows identical after authorized normalization"
        )
    return result


if __name__ == "__main__":
    compare_matrices(Path(os.environ["HAC44_CP2"]).resolve())
