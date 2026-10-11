"""Evidence rules without UML row names, historical verdicts, or row numbers."""
import ast
import re


def attribute_state(exists, mode, optional, output, evidence, nullable=False, uml_type=None):
    if mode in ("external_projection", "container"):
        return "PARCIAL", "Derived/scenario/container representation; exact field semantics not certified"
    if not exists or mode == "json" and output is None:
        return "FALTANTE", "No real column or typed JSON field at the resolved target"
    if output is None:
        return "PARCIAL", "Physical representation exists; no corresponding typed output"
    compatible = {"string":{"ZodString","ZodEnum","ZodLiteral"}, "UUID":{"ZodString"},
                  "boolean":{"ZodBoolean"}, "number":{"ZodNumber"}, "integer":{"ZodNumber"}}
    # A fixed-length tuple is a JSON array with a narrower cardinality contract.
    expected = {"ZodArray", "ZodTuple"} if uml_type and uml_type.endswith("[]") else compatible.get(uml_type)
    if expected and output.get("type") not in expected:
        return "DIVERGENTE", "Current output type contradicts the UML scalar/array type"
    if not optional and (output.get("nullable") or output.get("optional")):
        return "DIVERGENTE", "Required UML field permits null/absence in the measured output contract"
    if not optional and mode == "column" and nullable:
        return "PARCIAL", "Nullable physical column requires field-specific command proof"
    if any(e.get("state") == "VALUE" for e in evidence):
        return "COMPLETO", "Resolved storage and current typed output agree with a concrete POST/GET or measured read projection"
    return "PARCIAL", "No concrete non-null field value or measured read projection in this cut"


def relationship_state(treatment, end_labels, constraints, fk_evidence, semantic=None, absent=False):
    if absent:
        return "FALTANTE", "Declared canonical bridge/reference absent; alternate semantics not certified"
    if any(x.get("status") == "FAIL" for x in fk_evidence):
        return "DIVERGENTE", "Independent FK positive/negative pair failed"
    all_fk = bool(constraints) and len(fk_evidence) == len(constraints) and all(x.get("status") == "PASS" for x in fk_evidence)
    if not all_fk:
        return "PARCIAL", "Missing independent compatible FK proof; no blanket semantic certification"
    if semantic and semantic.get("status") == "PASS" and semantic.get("physicalVerified"):
        return "COMPLETO", "Current typed/physical representation and dedicated paired semantic controls PASS in this cut"
    cardinality = any("1..*" in x for x in end_labels) or end_labels == ["1", "1"]
    complex_representation = bool(re.search(
        r"\b(?:JSON|snapshot|derived|projection|inheritance|scenario|XOR|recovery|coupling|validated)\b",
        treatment, re.I,
    )) or len(constraints) > 1
    if cardinality or complex_representation:
        return "PARCIAL", "FK pairs PASS; dedicated minimum/maximum or representation semantics remain unproved"
    return "COMPLETO", "Direct physical FK with paired reference/orphan controls; no additional cardinality claim"


def native_control(source, log, positive_labels, negative_labels, cut_verified):
    """A named suite must have run successfully; source labels alone never certify it."""
    labels = positive_labels + negative_labels
    source_present = all("'" + label + "'" in source for label in labels)
    ran = bool(re.search(r"32_v2_hac40_uml_cardinalities\.test\.sql\s+\.{2,}\s+ok", log))
    passed = source_present and ran and "Result: PASS" in log and "EXIT_CODE: 0" in log and cut_verified
    return {"status": "PASS" if passed else "BLOQUEADO", "positive":positive_labels,
            "negative":negative_labels, "sourceLabelsPresent":source_present, "suiteExecuted":ran,
            "sameCut":cut_verified}


def fixed_row_verdicts(source):
    """Regression guard: row identity may resolve paths, never assign a fixed verdict."""
    violations = []
    tree = ast.parse(source)
    states = {"COMPLETO", "PARCIAL", "DIVERGENTE", "FALTANTE"}
    for function in [x for x in ast.walk(tree) if isinstance(x, ast.FunctionDef)
                     and x.name in ("attributes", "relationships", "attribute_state", "relationship_state")]:
        for branch in [x for x in ast.walk(function) if isinstance(x, ast.If)]:
            identity = any(isinstance(x,ast.Name) and x.id in ("name","attr","n","numero","uml_id") for x in ast.walk(branch.test))
            fixed = any(isinstance(x,ast.Constant) and x.value in states for statement in branch.body for x in ast.walk(statement) if isinstance(x,ast.Constant) and isinstance(x.value,str))
            if identity and fixed:
                violations.append(branch.lineno)
        for assignment in [x for x in ast.walk(function) if isinstance(x, (ast.Assign, ast.AnnAssign))]:
            value = assignment.value
            fixed = any(isinstance(x, ast.Constant) and isinstance(x.value,str) and x.value in states for x in ast.walk(value))
            identity = any(isinstance(x,ast.Name) and x.id in ("name","attr","n","numero","uml_id") for x in ast.walk(value))
            if fixed and identity:
                violations.append(assignment.lineno)
    return violations
