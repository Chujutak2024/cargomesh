import collections
import csv
import functools
import hashlib
import io
import json
import re

from common import LOGS, OUT, ROOT, save, write
from local import HEAD
from matrix_rules import attribute_state, relationship_state, native_control

CAT = json.loads((LOGS / "catalog.json").read_text(encoding="utf-8"))
SRC = json.loads((LOGS / "sources.json").read_text(encoding="utf-8"))
DES = json.loads(
    (OUT / "repro/sources/FULL_MODEL_PHYSICAL_DESIGN.json").read_text(encoding="utf-8")
)
TREES = json.loads((LOGS / "schema-trees.json").read_text(encoding="utf-8"))
COL = {
    (c["table_name"], c["column_name"]): c for c in CAT["columns"] if c["table_schema"] == "public"
}
CLASS = {c["name"]: c for c in DES["classes"]}
CATKINDS = dict(
    OrganizationPreferences="preferences",
    CargoProfile="cargo-profiles",
    CargoCategory="cargo-categories",
    Carrier="carriers",
    CarrierDepot="depots",
    CarrierService="services",
    ServiceArea="areas",
    ServiceLane="lanes",
    FulfilmentPartner="partners",
    TransportAsset="assets",
    RoadVehicle="assets",
    CapacityPool="capacity-pools",
    CapacityCalendar="calendars",
    ScheduledMaintenance="maintenances",
    RepositioningBlock="repositioning-blocks",
    Driver="drivers",
    DriverAssignment="driver-assignments",
    VehicleAssignment="vehicle-assignments",
    VehicleCombination="vehicle-combinations",
    AssetCargoCapability="capability-definitions",
)
WFKINDS = dict(
    AssetStatusEvent="asset-events",
    RoutePlan="routes",
    RoutePlanner="routes",
    RouteLeg="routes",
    RouteWaypoint="routes",
    RouteCondition="conditions",
    RoutePlanningPolicy="route-policies",
    TransportPlanCandidate="plans",
    PlanResource="plans",
    PlanLegAssignment="plans",
    LoadAllocation="plans",
    CarrierOpportunity="opportunities",
    CarrierOffer="offers",
    RankedOption="ranking",
    ScoringPolicy="scoring-policies",
    Booking="bookings",
    CapacityReservation="holds",
    TransportExecution="executions",
    OperationalIncident="incidents",
    IncidentUpdate="incident-updates",
    LogisticsNode="nodes",
    RouteCorridor="corridors",
    CarrierMetric="metrics",
    SelectionDecision="decisions",
    OfferCostComponent="offers",
)
CAT_OUTPUT_KEYS = {"cargo-categories": "catalog.ts:CargoCategoryValueV2Schema"}
READ_PROJECTIONS = {}
projection_file = LOGS / "contract-normalization-result.json"
if projection_file.exists():
    projection = json.loads(projection_file.read_text(encoding="utf-8"))
    if projection.get("status") == "PASS":
        READ_PROJECTIONS[projection["schema"], projection["path"]] = {
            **projection, "file": projection_file.name,
        }
ALIASES = {
    "FreightRequest": {"deliveryDeadline": "deliveryWindow.endsAt"},
    "CargoSpecification": {"category": "categoryCode"},
    "CargoUnit": {"dimensions": "dimensionsCm"},
    "TransportAsset": {"homeDepot": "homeDepotId"},
    "CapacityPool": {"partner": "provenance"},
    "CapacityReservation": {
        "occupiedWindow": "window",
        "committedCapacity": "capacityCommitted",
        "reference": "evidence.reference",
        "source": "evidence",
    },
    "Driver": {"portalAccount": "portalAccountId"},
    "IncidentUpdate": {"actor": "actorId"},
    "CarrierMetric": {"corridorRef": "corridorId"},
    "OrganizationPreferences": {"maximumWait": "maximumWaitMinutes"},
    "RoutePlan": {"estimatedDuration": "estimatedDurationSeconds"},
    "RouteLeg": {"estimatedDuration": "estimatedDurationSeconds"},
    "RouteCorridor": {"estimatedDuration": "estimatedDurationSeconds"},
    "CarrierOffer": {"transitDuration": "transitDurationSeconds"},
    "SelectionDecision": {"consideredOptions": "consideredOfferIds"},
    "ShipmentContact": {"phone": "phoneE164"},
}
GROUPS = {
    ("Facility", "location"): [
        "country_code",
        "region_code",
        "city",
        "address_line",
        "latitude",
        "longitude",
    ],
    ("CarrierDepot", "location"): [
        "address_line",
        "country_code",
        "region_code",
        "city",
        "latitude",
        "longitude",
    ],
    ("CarrierService", "temperatureRange"): ["temperature_min_c", "temperature_max_c"],
    ("CapacityPool", "serviceWindow"): ["starts_at", "ends_at"],
    ("CapacityPool", "declaredCapacity"): ["max_weight_kg", "max_volume_m3"],
    ("CapacityCalendar", "horizon"): ["horizon_starts_at", "horizon_ends_at"],
    ("CapacityReservation", "occupiedWindow"): ["starts_at", "ends_at"],
    ("ScheduledMaintenance", "blockedWindow"): ["starts_at", "ends_at"],
    ("DriverAssignment", "window"): ["starts_at", "ends_at"],
    ("VehicleAssignment", "window"): ["starts_at", "ends_at"],
    ("TransportExecution", "plannedWindow"): ["starts_at", "ends_at"],
    ("RepositioningBlock", "occupiedWindow"): ["starts_at", "ends_at"],
    ("VehicleCombination", "coupledWindow"): ["starts_at", "ends_at"],
    ("CargoCategory", "guidance"): [
        "recommended_entry_methods",
        "intake_specification_schema",
        "suggested_requirements",
        "recommended_vehicle_classes",
    ],
    ("ServiceArea", "geography"): [
        "granularity",
        "country_code",
        "region_code",
        "city",
        "postal_code",
        "geometry",
    ],
    ("ServiceArea", "source"): ["fulfilment_source", "fulfilment_partner_id"],
}
GROUPS["TransportExecution", "plannedWindow"] = ["planned_starts_at", "planned_ends_at"]
OVERRIDE = {
    ("CarrierService", "status"): "carrier_services.active",
    ("CarrierService", "admittedCargoTypes"): "carrier_service_cargo_categories.cargo_category_id",
    ("CargoCategory", "version"): "cargo_categories.version",
    ("OrganizationPreferences", "maximumWait"): "organization_preferences.maximum_wait_minutes",
    ("OrganizationMember", "contactRef"): "organization_members.corporate_email",
    ("CarrierOffer", "requestId"): "v2_carrier_offers.freight_request_id",
    ("CarrierOffer", "planCandidateId"): "v2_carrier_offers.plan_id",
    ("CarrierOffer", "opportunityId"): "v2_carrier_offers.parent_id",
    ("Booking", "selectionDecisionId"): "v2_bookings.decision_id",
    ("SelectionDecision", "selectedPlanId"): "selection_decisions.plan_id",
    ("CapacityReservation", "planResourceId"): "capacity_reservations.plan_resource_id",
}
WFSPECIAL = {
    "RouteLeg": "legs[]",
    "RoutePlanner": "planner",
    "RouteWaypoint": "legs[].waypoints[]",
    "PlanResource": "assignments[].resource",
    "PlanLegAssignment": "legAssignments[]",
    "LoadAllocation": "assignments[].allocations[]",
    "RankedOption": "options[]",
    "ScoringPolicy": "policy",
    "OfferCostComponent": "breakdown[]",
}
SOURCES = {}
for path in (
    [
        ROOT / p["path"]
        for p in json.loads((LOGS / "migration-hashes.json").read_text(encoding="utf-8"))
    ]
    + list((ROOT / "cargomesh/src/shared/schemas/v2").glob("*.ts"))
    + list((ROOT / "cargomesh/src/server/modules").glob("*/application/*service.ts"))
):
    SOURCES[str(path.relative_to(ROOT)).replace("\\", "/")] = path.read_text(
        encoding="utf-8-sig"
    ).splitlines()


def jsonstr(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def node(tree, path):
    for p in path.split(".") if path else []:
        isarr = p.endswith("[]")
        p = p.removesuffix("[]")
        tree = (tree or {}).get("fields", {}).get(p)
        if isarr:
            tree = (tree or {}).get("element")
    return tree


def value(data, path):
    for part in path.split(".") if path else []:
        arr = part.endswith("[]")
        part = part.removesuffix("[]")
        if not isinstance(data, dict) or part not in data:
            return ("MISSING", None)
        data = data[part]
        if arr:
            if not isinstance(data, list) or not data:
                return ("EMPTY_ARRAY", None)
            data = data[0]
    return ("NULL" if data is None else "EMPTY_ARRAY" if data == [] else "VALUE", data)


def workflow_output(kind):
    return next(
        t
        for t in TREES["workflow.ts:WorkflowRecordV2Schema"]["options"]
        if t["fields"]["kind"].get("value") == kind
    )


def schema_paths(name, attr):
    """Resolve a UML attribute's input and output paths in the Zod inventory."""
    a = ALIASES.get(name, {}).get(attr, attr)
    if name in CATKINDS:
        kind = CATKINDS[name]
        it = TREES["catalog.ts:CatalogInputsV2:" + kind]
        ot = TREES.get(CAT_OUTPUT_KEYS.get(kind, "fleet.ts:FleetOutputsV2:" + kind), it)
        prefix = "roadVehicle." if name == "RoadVehicle" else ""
        ip = prefix + a
        op = "value." + prefix + a
        if attr in ("id", "version", "createdAt", "updatedAt") and name != "RoadVehicle" and node(ot, prefix + a) is None:
            op = attr
        if name == "Carrier" and attr == "verifiedContact":
            op = attr
        return (
            node(it, ip),
            (
                node(TREES["catalog.ts:CatalogRecordV2Schema"], op)
                if op == attr or attr == "verifiedContact"
                else node(ot, prefix + a)
            ),
            ip,
            op,
            "catalog.ts:CatalogInputsV2:" + kind,
        )
    if name == "Organization":
        return (
            node(TREES["organization.ts:OrganizationValueV2Schema"], a),
            node(
                TREES["organization.ts:OrganizationRecordV2Schema"],
                ("id" if attr == "id" else "value." + a),
            ),
            a,
            ("id" if attr == "id" else "value." + a),
            "organization.ts:OrganizationValueV2Schema",
        )
    if name == "Facility":
        return (
            node(TREES["facilities.ts:FacilityInputV2Schema"], a),
            node(TREES["facilities.ts:FacilityV2Schema"], ("id" if attr == "id" else "value." + a)),
            a,
            ("id" if attr == "id" else "value." + a),
            "facilities.ts:FacilityInputV2Schema",
        )
    if name in ("FreightRequest", "CargoSpecification", "CargoUnit", "ShipmentContact"):
        prefix = {
            "FreightRequest": "",
            "CargoSpecification": "cargoSpecification.",
            "CargoUnit": "cargoSpecification.units[].",
            "ShipmentContact": "contacts.pickup.",
        }[name]
        ip = prefix + a
        op = ip
        output = node(TREES["freight-request.ts:FreightRequestV2ResponseSchema"], "data." + op)
        proof = READ_PROJECTIONS.get(("freight-request.ts:FreightRequestV2ResponseSchema", "data." + op))
        if proof:
            output = {**(output or {}), **proof["outputNode"], "measuredProjection":proof["file"]}
        return (
            node(TREES["freight-request.ts:CreateFreightRequestV2InputSchema"], ip),
            output,
            ip,
            op,
            "freight-request.ts:CreateFreightRequestV2InputSchema",
        )
    if name in WFKINDS:
        kind = WFKINDS[name]
        ot = workflow_output(kind)
        prefix = WFSPECIAL.get(name, "")
        op = "data." + (prefix + "." if prefix else "") + a
        if attr in ("id", "status") and name not in WFSPECIAL:
            op = attr
        # Domain version string lives in JSON, distinct from integer command revision.
        if name == "CarrierOffer" and attr in ("id", "status"):
            op = attr
        if name == "Booking" and attr == "selectionDecisionId":
            op = "data.decisionId"
        if name == "SelectionDecision" and attr == "selectedPlanId":
            op = "data.selectedPlanId"
        if name == "PlanResource" and attr == "id":
            op = "data.assignments[].resourceId"
        actions = {
            "AssetStatusEvent": "asset-events.create",
            "RouteCondition": "conditions.publish",
            "RoutePlanningPolicy": "route-policies.publish",
            "CarrierOpportunity": "opportunities.create",
            "CarrierOffer": "offers.create",
            "ScoringPolicy": "scoring-policies.publish",
            "Booking": "bookings.create",
            "CapacityReservation": "holds.create",
            "TransportExecution": "executions.create",
            "OperationalIncident": "incidents.create",
            "IncidentUpdate": "incidents.update",
            "LogisticsNode": "nodes.publish",
            "RouteCorridor": "corridors.publish",
            "CarrierMetric": "metrics.publish",
            "SelectionDecision": "decisions.create",
        }
        action = actions.get(name)
        it = TREES.get("workflow.ts:WorkflowInputsV2:" + str(action), {})
        ip = (prefix + "." if prefix else "") + a
        if name == "ScoringPolicy":
            ip = "policy." + a
        if name == "OfferCostComponent":
            it = TREES["workflow.ts:WorkflowInputsV2:offers.create"]
        # Generated plan/route fields are written by their native parent command, not arbitrary DTO writes.
        return (
            node(it, ip),
            node(ot, op),
            ip,
            op,
            "workflow.ts:WorkflowInputsV2:"
            + str(
                action
                or (
                    "plans.create"
                    if kind == "plans"
                    else "routes.create" if kind == "routes" else kind + ".create"
                )
            ),
        )
    return None, None, "—", "—", "—"


def storage(name, a, op):
    """Resolve the physical storage or projection for a UML attribute."""
    tab = CLASS[name]["storage"].split(".")[0]
    attribute = next(x for x in CLASS[name]["attributes"] if x["name"] == a)
    target = attribute.get("currentTreatment", {}).get("target", attribute["target"])
    if attribute.get("currentTreatment"):
        return [target], "json" if len(target.split(".")) > 2 else "column"
    if (name, a) in OVERRIDE:
        target = OVERRIDE[name, a]
    if "{" in target:
        return [target], "container"
    if tab.startswith("|") and tab.endswith(("_projection", "_files")):
        return [target], "external_projection"
    if (name, a) in GROUPS:
        return [tab + "." + col for col in GROUPS[name, a]], "projection"
    if name in ("CargoSpecification", "CargoUnit", "ShipmentContact"):
        return ["freight_requests.v2_snapshot." + op], "json"
    if name == "OfferCostComponent":
        return ["v2_carrier_offers.data.breakdown[]." + a], "json"
    if name in WFKINDS:
        if name in WFSPECIAL:
            # Child rows persist data relative to their own entity, while HTTP embeds them in the parent.
            childpath = ALIASES.get(name, {}).get(a, a)
            direct = target.split(".")[:2]
            if tuple(direct) in COL:
                return [target], "column"
            return [
                tab + ".data." + (("policy." if name == "ScoringPolicy" else "") + childpath)
            ], "json"
        if tuple(target.split(".")[:2]) in COL and a not in ("version",):
            return [target], "column"
        path = op.removeprefix("data.")
        if op in ("id", "status", "version", "requestId", "carrierId"):
            path = {"requestId": "freight_request_id", "carrierId": "carrier_id"}.get(op, op)
            return [tab + "." + path], "column"
        return [tab + ".data." + path], "json"
    return [target.split(";")[0]], "column"


@functools.lru_cache(maxsize=None)
def source_line(tab, col=None):
    fallback = None
    for file, lines in SOURCES.items():
        if "/migrations/" not in file:
            continue
        for i, line in enumerate(lines):
            if re.search(
                r"create table(?: if not exists)?\s+(?:public\.)?" + re.escape(tab) + r"\b",
                line,
                re.I,
            ):
                if not col:
                    return f"{file}:{i+1}"
                # Stop at this CREATE statement, never cross into the next table.
                depth = 0
                opened = False
                quoted = False
                for j in range(i, len(lines)):
                    for ch in lines[j]:
                        if ch == "'":
                            quoted = not quoted
                        elif not quoted and ch == "(":
                            depth += 1
                            opened = True
                        elif not quoted and ch == ")":
                            depth -= 1
                    if re.match(r"\s*" + re.escape(col) + r"\s+", lines[j], re.I) or re.search(
                        r"[(,]\s*"
                        + re.escape(col)
                        + (
                            "\\s+(?:uuid|text|varchar|numeric|integer|int|boolean|jsonb|timestamp|date|dou"
                            "ble|bigint)\\b"
                        ),
                        lines[j],
                        re.I,
                    ):
                        return f"{file}:{j+1}"
                    if opened and depth <= 0:
                        break
            if re.search(r"alter table\s+(?:public\.)?" + re.escape(tab) + r"\b", line, re.I):
                statement = []
                for j in range(i, len(lines)):
                    statement.append(lines[j])
                    if ";" in lines[j]:
                        break
                if col and re.search(
                    r"add column(?: if not exists)?\s+" + re.escape(col) + r"\b",
                    "\n".join(statement),
                    re.I,
                ):
                    return f"{file}:{i+1}"
        if any(re.search(r"\b" + re.escape(tab) + r"\b", l) for l in lines):
            # Generic workflow DDL and table dispatch require recording the exact table inclusion line.
            j = next(i for i, l in enumerate(lines) if re.search(r"\b" + re.escape(tab) + r"\b", l))
            if fallback is None:
                fallback = f"{file}:{j+1} (generic DDL/dispatch; see catalog)"
    return fallback or "NO_DEFINITION"


def dto_line(key, attr):
    if key == "—":
        return "—"
    file = "cargomesh/src/shared/schemas/v2/" + key.split(":")[0]
    lines = SOURCES[file]
    token = key.split(":")[-1].split(".")[0]
    if token in ("CatalogInputsV2", "WorkflowInputsV2"):
        token = key.split(":")[1]
    n = next((i + 1 for i, l in enumerate(lines) if token in l), 1)
    return file + ":" + str(n) + "; schema " + key + "; field " + attr


def output_key(name, attr, key):
    if name in CATKINDS:
        kind = CATKINDS[name]
        domain = CAT_OUTPUT_KEYS.get(kind)
        if domain and node(TREES[domain], ALIASES.get(name, {}).get(attr, attr)) is not None:
            return domain
        if (
            attr in ("id", "version", "createdAt", "updatedAt")
            or name == "Carrier"
            and attr == "verifiedContact"
        ):
            return "catalog.ts:CatalogRecordV2Schema"
        return (
            ("fleet.ts:FleetOutputsV2:" + kind)
            if "fleet.ts:FleetOutputsV2:" + kind in TREES
            else key
        )
    if name == "Organization":
        return "organization.ts:OrganizationRecordV2Schema"
    if name == "Facility":
        return "facilities.ts:FacilityV2Schema"
    if name in ("FreightRequest", "CargoSpecification", "CargoUnit", "ShipmentContact"):
        return "freight-request.ts:FreightRequestV2ResponseSchema"
    if name in WFKINDS:
        return "workflow.ts:WorkflowRecordV2Schema"
    return "—"


@functools.lru_cache(maxsize=None)
def operation_paths(name):
    # Embedded values/subtypes inherit their aggregate's native operations.
    if name in CATKINDS:
        kind = CATKINDS[name]
        prefix = (
            "/organizations/current/preferences"
            if kind == "preferences"
            else (
                "/" + kind
                if kind in ("cargo-categories", "cargo-profiles", "carriers")
                else (
                    "/carriers/:carrierId/services/:serviceId/" + kind
                    if kind in ("areas", "lanes")
                    else "/carriers/:carrierId/" + kind
                )
            )
        )
    elif name == "Organization":
        prefix = "/organizations/current"
    elif name == "Facility":
        prefix = "/facilities"
    elif name in ("FreightRequest", "CargoSpecification", "CargoUnit", "ShipmentContact"):
        prefix = "/freight/requests"
    elif name in WFKINDS:
        kind = WFKINDS[name]
        prefix = {
            "asset-events": "/carriers/:carrierId/assets/:parentId/events",
            "routes": "/freight/requests/:requestId/routes",
            "plans": "/freight/requests/:requestId/plans",
            "conditions": "/routing/conditions",
            "route-policies": "/routing/policies",
            "nodes": "/routing/nodes",
            "corridors": "/routing/corridors",
            "opportunities": "/carriers/:carrierId/opportunities",
            "offers": "/carriers/:carrierId/offers",
            "metrics": "/carriers/:carrierId/metrics",
            "scoring-policies": "/scoring/policies",
            "ranking": "/freight/requests/:requestId/ranking",
            "decisions": "/freight/requests/:requestId/decisions",
            "holds": "/capacity/holds",
            "executions": "/executions",
            "bookings": "/bookings",
            "incidents": "/executions/:parentId/incidents",
            "incident-updates": "/incidents/:parentId/updates",
        }.get(kind)
    else:
        return {
            "write": "NO_HONO_OPERATION; see service/port/identity evidence",
            "read": "NO_HONO_OPERATION; see service/port/identity evidence",
        }
    routes = json.loads((LOGS / "routes-runtime.json").read_text(encoding="utf-8"))
    prefixes = [prefix] if prefix else []
    if name == "RoutePlanner":
        prefixes = ["/freight/requests/:requestId/route-alternatives", "/routes/:id/replans", "/routes/:id/explanation"]
    if name in WFKINDS:
        kind = WFKINDS[name]
        prefixes += {
            "opportunities": ["/freight/requests/:requestId/opportunities"],
            "offers": ["/freight/requests/:requestId/offers"],
            "bookings": ["/carriers/:carrierId/bookings"],
            "holds": ["/carriers/:carrierId/capacity/holds", "/bookings/:parentId/reservations"],
            "executions": ["/carriers/:carrierId/executions", "/bookings/:parentId/execution"],
            "incidents": ["/carriers/:carrierId/executions/:parentId/incidents"],
            "incident-updates": ["/carriers/:carrierId/incidents/:parentId/updates"],
        }.get(kind, [])
    selected = [
        r
        for r in routes
        if any(
            r["path"] == "/api/v2" + p or r["path"].startswith("/api/v2" + p + "/")
            for p in prefixes
        )
    ]
    return {
        k: "; ".join(r["method"] + " " + r["path"] for r in selected if r["method"] == method)
        or "NO_MATCHING_HONO_ROUTE"
        for k, method in [("write", "POST"), ("read", "GET")]
    }


def rows_from_evidence():
    files = [
        "first-roundtrips.json",
        "roundtrips.json",
        "extended-roundtrips.json",
        "ltl-roundtrips.json",
        "contract-roundtrips.json",
    ]
    rows = []
    for f in files:
        if (LOGS / f).exists():
            rows.extend(
                {**r, "log": f, "number": i}
                for i, r in enumerate(json.loads((LOGS / f).read_text(encoding="utf-8")), 1)
            )
    return rows


RT = rows_from_evidence()


def ev_for(name, op, ip):
    kind = CATKINDS.get(
        name,
        WFKINDS.get(
            name,
            {
                "Organization": "organizations",
                "Facility": "facilities",
                "FreightRequest": "request",
                "CargoSpecification": "request",
                "CargoUnit": "request",
                "ShipmentContact": "request",
            }.get(name),
        ),
    )
    aliases = {"nodes": ["node", "nodes"], "plans": ["plans"], "offers": ["offers"]}
    kinds = aliases.get(kind, [kind])
    found = []
    for r in RT:
        if r["kind"] not in kinds:
            continue
        state, read = value(r.get("read"), op)
        ws, written = value(r.get("written"), op)
        ins, inputvalue = value(r.get("input"), ip)
        if state in ("MISSING", "EMPTY_ARRAY") or ws != state:
            continue
        if read != written:
            continue
        found.append(
            {
                "file": r["log"],
                "row": r["number"],
                "id": r["id"],
                "state": state,
                "inputState": ins,
                "inputEqualsRead": (
                    inputvalue == read if ins not in ("MISSING", "EMPTY_ARRAY") else None
                ),
                "value": read,
            }
        )
    return found


def csvwrite(file, rows):
    s = io.StringIO(newline="")
    w = csv.DictWriter(s, fieldnames=list(rows[0]), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    write(OUT / file, s.getvalue())
    r = list(csv.DictReader((OUT / file).open(encoding="utf-8", newline="")))
    assert len(r) == len(rows)


def attributes():
    """Generate attribute classifications from physical, schema and execution evidence."""
    rows = []
    dictionary = {c["name"]: c for c in SRC["dictionary"]}
    for c in DES["classes"]:
        name = c["name"]
        tab = c["storage"].split(".")[0]
        for index, a in enumerate(c["attributes"]):
            attr = a["name"]
            it, ot, ip, op, key = schema_paths(name, attr)
            paths, mode = storage(name, attr, op)
            cols = [COL.get(tuple(p.split(".")[:2])) for p in paths]
            exists = all(cols)
            ev = ev_for(name, op, ip)
            proof = READ_PROJECTIONS.get((output_key(name, attr, key), "data." + op))
            if proof:
                ev.append({"file":proof["file"], "row":1, "id":proof.get("id"),
                    "state":"VALUE", "inputState":"MISSING", "inputEqualsRead":None,
                    "value":proof["value"], "controls":proof["checks"]})
            status, reason = attribute_state(exists, mode, a["optional"], ot, ev,
                nullable=any(x and x["is_nullable"] == "YES" for x in cols), uml_type=a["type"])
            notes = [reason]
            if proof:
                notes.append("Current response transform measured with valid/omitted array and rejected null: " + proof["file"])
            if ot and ot.get("type") == "ZodString" and any(x and x["data_type"] in ("integer", "bigint") for x in cols):
                notes.append("Domain string is projected from the technical integer; verify exact POST/GET value and contract-category-version-result.json")
            if mode == "json" and paths[0] != a["target"]:
                notes.append("DER names a separate column; actual is typed JSON; documentary reconciliation remains")
            owner = (
                "HAC-41 / Axel"
                if name
                in (
                    "OrganizationMember",
                    "McpAccountLink",
                    "CarrierOperator",
                    "ResponseIntegration",
                )
                else "HAC-40 / Cristhian"
            )
            dic = dictionary[name]["attributes"][index]
            cons = [
                x["conname"] + ": " + x["definition"]
                for x in CAT["constraints"]
                if x["relation"].split(".")[-1] in {p.split(".")[0] for p in paths}
                and (
                    mode == "json"
                    or any(
                        re.search(r"\b" + re.escape(p.split(".")[1]) + r"\b", x["definition"])
                        for p in paths
                        if len(p.split(".")) > 1
                    )
                )
            ]
            idx = [
                x["indexdef"]
                for x in CAT["indexes"]
                if x["tablename"] in {p.split(".")[0] for p in paths}
                and (
                    mode == "json"
                    or any(p.split(".")[1] in x["indexdef"] for p in paths if len(p.split(".")) > 1)
                )
            ]
            record = {
                "numero": len(rows) + 1,
                "clase": name,
                "atributo": attr,
                "tipo_uml": a["type"],
                "opcional_uml": a["optional"],
                "diccionario_tratamiento": dic["treatment"],
                "diccionario_representacion": dic["representation"],
                "diccionario_linea": dic["line"],
                "der_destino": a["target"],
                "representacion_real": "; ".join(paths),
                "tipo_fisico": "; ".join(x["data_type"] if x else "NO_COLUMN" for x in cols),
                "nullable_fisico": "; ".join(x["is_nullable"] if x else "N/A" for x in cols),
                "default_fisico": "; ".join(str(x["column_default"]) if x else "N/A" for x in cols),
                "restricciones": "; ".join(cons),
                "indices": "; ".join(idx),
                "dto_escritura": (
                    dto_line(key, ip)
                    if it
                    else "GENERATED_BY_PARENT_COMMAND" if name in WFKINDS else "NO_WRITABLE_DTO"
                ),
                "ruta_input": ip if it else "—",
                "tipo_dto_input": it.get("type") if it else "—",
                "optional_dto_input": it.get("optional") if it else "—",
                "nullable_dto_input": it.get("nullable") if it else "—",
                "restriccion_dto_input": jsonstr(it) if it else "—",
                "dto_lectura": dto_line(key, op) if ot else "NO_TYPED_OUTPUT",
                "ruta_output": op,
                "tipo_dto_output": ot.get("type") if ot else "—",
                "optional_dto_output": ot.get("optional") if ot else "—",
                "nullable_dto_output": ot.get("nullable") if ot else "—",
                "migracion_linea": "; ".join(
                    source_line(p.split(".")[0], p.split(".")[1] if len(p.split(".")) > 1 else None)
                    for p in paths
                ),
                "api_servicio": CATKINDS.get(
                    name,
                    WFKINDS.get(
                        name,
                        (
                            "request"
                            if name
                            in (
                                "FreightRequest",
                                "CargoSpecification",
                                "CargoUnit",
                                "ShipmentContact",
                            )
                            else name
                        ),
                    ),
                ),
                "evidencia_roundtrip": jsonstr(ev),
                "estado": status,
                "justificacion": "; ".join(notes),
                "dueno": owner,
                "sha": HEAD,
            }
            ops = operation_paths(name)
            record.update(
                {
                    "dto_lectura": (
                        dto_line(output_key(name, attr, key), op) if ot else "NO_TYPED_OUTPUT"
                    ),
                    "endpoint_escritura": ops["write"],
                    "endpoint_lectura": ops["read"],
                    "permisos_rls": "logs/class-matrix.json: "
                    + name
                    + (
                        " (catalog grants/policies/table ACL); logs/independent-rls-result.json; "
                        "logs/auth-controls.json"
                    ),
                }
            )
            rows.append(record)
    assert len(rows) == 397
    csvwrite("HAC-44_matriz_atributos.csv", rows)
    save("attribute-matrix.json", rows)
    return rows


# Actual relation paths with equivalent joins are explicit. Missing bridges are not inferred from names.
REL_OVERRIDE = {
    27: "transport_plan_candidates.freight_request_id",
    30: "route_waypoints.route_leg_id -> route_legs.id -> route_plans.id",
    31: "route_legs.data.conditions[] (snapshot; no route_leg_conditions bridge)",
    33: "plan_resources.plan_id",
    35: (
        "plan_resource_bindings.resource_id -> plan_resources.id; "
        "plan_resource_bindings.route_leg_id -> "
        "route_legs.id"
    ),
    37: "carrier_opportunities.plan_id",
    39: "v2_carrier_offers.parent_id",
    42: "ranked_options.ranking_id -> v2_rankings.data.policyId (JSON reference)",
    47: "operational_incidents.parent_id",
    48: "incident_updates.parent_id",
    49: "NO incident_route_conditions bridge or incident→condition API",
    52: "route_legs.corridor_id",
    56: "load_allocations.assignment_id -> plan_resource_bindings.resource_id -> plan_resources.id",
    62: "plan_resources.combination_id",
    67: (
        "NO plan_leg_assignments.fulfilment_partner_id; partner available only "
        "through source/carrier "
        "snapshots"
    ),
    69: "plan_leg_assignments.plan_id",
    70: "plan_resource_bindings.leg_assignment_id -> plan_leg_assignments.id; plan_resource_bindings.resource_id -> plan_resources.id",
    72: (
        "v2_carrier_offers.data.coveredAssignmentIds[] (validated command; no "
        "v2_offer_assignments "
        "bridge)"
    ),
    75: "v2_carrier_offers.data.source.issuerId -> organization_members; no issuer_operator_id FK",
    77: (
        "asset_cargo_capabilities.definition_id + transport_asset_id; no "
        "transport_assets.cargo_capability_definition_id"
    ),
    84: "v2_bookings.decision_id",
    85: "selection_decisions.selected_by",
    86: "selection_offers.decision_id + offer_id",
    87: "selection_decisions.freight_request_id",
    88: "selection_decisions.plan_id",
    89: "v2_carrier_offers.freight_request_id",
    90: "capacity_reservations.plan_resource_id -> plan_resources.id",
    92: (
        "v2_carrier_offers.data.coveredServiceIds[] (validated command; no "
        "v2_offer_services "
        "bridge)"
    ),
    93: "capacity_reservations.booking_id",
}


def semantic_controls():
    """Join fresh native/HTTP controls to physical paths, never to a UML row verdict."""
    source_path = ROOT / "supabase/tests/32_v2_hac40_uml_cardinalities.test.sql"
    source = source_path.read_text(encoding="utf-8-sig")
    native_path = LOGS / "gate-v2-pgtap.log"
    native_log = native_path.read_text(encoding="utf-8") if native_path.exists() else ""
    gate_path = LOGS / "native-gates.json"
    gate = json.loads(gate_path.read_text(encoding="utf-8")) if gate_path.exists() else {}
    same_cut = gate.get("head") == HEAD and gate.get("status") == "PASS"
    def unique(table, column):
        return any(c["relation"].split(".")[-1] == table and c["contype"] in ("u", "p")
            and re.search(r"(?:UNIQUE|PRIMARY KEY) \(" + re.escape(column) + r"\)", c["definition"])
            for c in CAT["constraints"])
    descriptors = [
        {"tokens":[["transport_plan_candidates","route_plan_id"]],
         "positive":["F05: load-bearing and auxiliary resources are both evaluated"],
         "negative":["F05: database prevents two candidates owning one route"],
         "unique":["transport_plan_candidates","route_plan_id"],
         "http":"contract-route-cardinality-result.json"},
        {"tokens":[["plan_resource_bindings","leg_assignment_id"],["plan_resource_bindings","resource_id"]],
         "positive":["F05: one canonical leg assignment","F05: assignment owns two resources","F05: authenticated command reaches deferred constraint verification"],
         "negative":["F05: empty resource ownership is rejected before storage","F05: zero-resource assignment cannot survive constraint verification"],
         "unique":["plan_resource_bindings","resource_id"],
         "minimumPath":"data.legAssignments[].resources"},
        {"tokens":[["capacity_reservations","plan_resource_id"]],
         "positive":["F05: first resource confirms","F05: reservations have direct resource and canonical assignment FKs"],
         "negative":["F05: multi-resource hold requires explicit resource","F05: reservation cannot substitute another plan resource"],
         "outputPath":"data.planResourceId"},
    ]
    proofs = []
    for descriptor in descriptors:
        proof = native_control(source, native_log, descriptor["positive"], descriptor["negative"], same_cut)
        physical = all(tuple(token) in COL for token in descriptor["tokens"])
        if descriptor.get("unique"):
            physical = physical and unique(*descriptor["unique"])
        if descriptor.get("http"):
            path = LOGS / descriptor["http"]
            http = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
            physical = physical and http.get("status") == "PASS" and all(http.get("checks", {}).values()) and bool(http.get("checks"))
            proof["HTTP"] = {"file":descriptor["http"],"status":http.get("status"),"checks":http.get("checks")}
        if descriptor.get("minimumPath"):
            output = node(workflow_output("plans"), descriptor["minimumPath"])
            guarded = any(t["tgname"] == "leg_requires_resources" and t["tgenabled"] != "D"
                and "DEFERRABLE INITIALLY DEFERRED" in t["definition"] for t in CAT["triggers"])
            physical = physical and bool(output) and output.get("minLength", {}).get("value", 0) >= 1 and guarded
            proof["typedMinimum"] = output
            proof["deferredGuardEnabled"] = guarded
        if descriptor.get("outputPath"):
            output = node(workflow_output("holds"), descriptor["outputPath"])
            physical = physical and bool(output) and not output.get("optional") and not output.get("nullable")
            proof["typedReference"] = output
        proof.update({"tokens":descriptor["tokens"],"physicalVerified":bool(physical),
            "source":"supabase/tests/32_v2_hac40_uml_cardinalities.test.sql",
            "sourceSha256":hashlib.sha256(source.encode()).hexdigest(),"log":native_path.name,"cut":HEAD,
            "sourceLines":{label: next((i for i,line in enumerate(source.splitlines(),1) if "'"+label+"'" in line),None)
                for label in descriptor["positive"] + descriptor["negative"]}})
        proofs.append(proof)
    save("matrix-semantic-controls.json",proofs)
    return proofs


SEMANTIC_CONTROLS = semantic_controls()


def semantic_for(tokens):
    return next((proof for proof in SEMANTIC_CONTROLS if set(map(tuple,proof["tokens"])).issubset(set(tokens))),None)


def relationships():
    """Generate relationship classifications with exact referential evidence."""
    rows = []
    fkp = json.loads((LOGS / "independent-fk-pairs.json").read_text(encoding="utf-8"))
    fkstates = {c["constraint"]: c for c in fkp["cases"]}
    current = {(r["source"], r["target"]): r for r in DES.get("currentRelationReconciliation", {}).get("relations", [])}
    for n, r in enumerate(DES["relations"], 1):
        reconciliation = current.get((r["source"], r["target"]))
        treatment = reconciliation["treatment"] if reconciliation else REL_OVERRIDE.get(n, r["physicalTreatment"])
        if r["source"] == "RoutePlanner" and any(f["proname"] == "command_v2_route_planner" for f in CAT["functions"]):
            treatment = "route_plans.data.planner snapshot and planner.search network/policy/condition revisions; command_v2_route_planner"
        tokens = re.findall(r"\b([a-z][a-z0-9_]+)\.([a-z][a-z0-9_]+)\b", treatment)
        if reconciliation:
            bridge_tables = re.findall(r"\b([a-z][a-z0-9_]+)\s*\(", treatment)
            for constraint in CAT["constraints"]:
                table = constraint["relation"].split(".")[-1]
                if constraint["contype"] == "f" and table in bridge_tables:
                    columns = re.search(r"FOREIGN KEY \(([^)]+)\)", constraint["definition"])[1].split(", ")
                    tokens.extend((table, column) for column in columns)
        tables = {t for t, col in tokens}
        constraints = []
        for c in CAT["constraints"]:
            child = c["relation"].split(".")[-1]
            fkcols = (
                re.search(r"FOREIGN KEY \(([^)]+)\)", c["definition"])
                if c["contype"] == "f"
                else None
            )
            if fkcols and any(child == t and col in fkcols[1].split(", ") for t, col in tokens):
                constraints.append(c)
        cols = [COL[(t, col)] for t, col in tokens if (t, col) in COL]
        evidence = [fkstates[c["conname"]] for c in constraints if c["conname"] in fkstates]
        indexes = [x["indexdef"] for x in CAT["indexes"] if x["tablename"] in tables]
        checks = [
            c["definition"]
            for c in CAT["constraints"]
            if c["relation"].split(".")[-1] in tables and c["contype"] in ("c", "u", "p", "x")
        ]
        semantic = semantic_for(tokens)
        canonical_tokens = re.findall(r"\b([a-z][a-z0-9_]+)\.([a-z][a-z0-9_]+)\b", r.get("designTreatment", ""))
        canonical_missing = bool(canonical_tokens) and not all((t, c) in COL for t, c in canonical_tokens)
        absent = treatment.startswith("NO ") or bool(re.search(r"\bno [a-z_]+ FK", treatment)) and canonical_missing
        status, reason = relationship_state(treatment + "; " + r.get("designTreatment", ""),
            r["endLabels"], constraints, evidence, semantic, absent=absent)
        if any(e["status"] == "BLOQUEADO" for e in evidence):
            reason += "; at least one independent FK prerequisite is BLOQUEADO"
        owner = "HAC-41 / Axel" if n in (13, 57, 58, 75, 76) else "HAC-40 / Cristhian"
        api = CATKINDS.get(r["target"], WFKINDS.get(r["target"], r["target"]))
        rows.append(
            {
                "numero": n,
                "uml_id": r["umlId"],
                "origen": r["source"],
                "destino": r["target"],
                "etiqueta": r["label"],
                "multiplicidad_uml": jsonstr(r["endLabels"]),
                "der_equivalente": r["physicalTreatment"],
                "equivalente_real": treatment,
                "fk_reales": "; ".join(c["conname"] + ": " + c["definition"] for c in constraints),
                "nullable_fk": "; ".join(
                    c["table_name"] + "." + c["column_name"] + "=" + c["is_nullable"] for c in cols
                ),
                "unique_check_exclusion": "; ".join(checks),
                "indices": "; ".join(indexes),
                "migracion_linea": "; ".join(source_line(t, col) for t, col in tokens)
                or source_line(CLASS[r["target"]]["storage"].split(".")[0]),
                "api_servicio": api,
                "evidencia": jsonstr(evidence),
                "evidencia_semantica": jsonstr(semantic) if semantic else "No dedicated semantic proof for this resolved physical path; FK evidence above is limited",
                "estado": status,
                "justificacion": reason,
                "dueno": owner,
                "sha": HEAD,
            }
        )
        ops = operation_paths(r["target"])
        rows[-1].update(
            {
                "operacion_crea": ops["write"],
                "operacion_consulta": ops["read"],
                "multiplicidad_fisica": "; ".join(c["definition"] for c in constraints)
                + (
                    "; max child count limited only by matching UNIQUE; NULL flags above; "
                    "minimum 1..* not proven by a "
                    "FK"
                ),
            }
        )
    assert len(rows) == 93
    csvwrite("HAC-44_matriz_relaciones.csv", rows)
    save("relationship-matrix.json", rows)
    return rows


def classes(attrs):
    """Aggregate the attribute classifications into the UML class matrix."""
    rows = []
    relations = json.loads((LOGS / "relationship-matrix.json").read_text(encoding="utf-8"))
    for c in DES["classes"]:
        name = c["name"]
        ar = [r for r in attrs if r["clase"] == name]
        counts = dict(collections.Counter(r["estado"] for r in ar))
        status = (
            "COMPLETO"
            if set(counts) == {"COMPLETO"}
            else (
                "FALTANTE"
                if set(counts) == {"FALTANTE"}
                else "DIVERGENTE" if "DIVERGENTE" in counts else "PARCIAL"
            )
        )
        tab = c["storage"].split(".")[0]
        related = [r for r in relations if name in (r["origen"], r["destino"])]
        semantic = {
            "ServiceLane": (
                "Native lane same-service/role/validity cases + HTTP directed "
                "create/read/revision; supabase/tests/09_v2_clean_road_network.test.sql; "
                "logs/pgtap-v2.log; "
                "api-results.json"
            ),
            "DriverAssignment": (
                "Native crew positive assignment / overlap / duty policies + authenticated "
                "confirmed assignment HTTP; supabase/tests/21_v2_hac40_crew.test.sql; "
                "logs/pgtap-v2.log; extended-api-results.json"
            ),
            "CarrierOpportunity": (
                "Native invitation/attributable offer checks + HTTP invite/accept/offer and "
                "cross-tenant controls; supabase/tests/22_v2_hac40_workflow.test.sql; "
                "logs/extended-api-results.json"
            ),
        }
        if status == "COMPLETO" and (
            any(r["estado"] != "COMPLETO" for r in related) or name not in semantic
        ):
            status = "PARCIAL"
        rows.append(
            {
                "clase": name,
                "representacion": c["representation"],
                "destino": "; ".join(sorted({a["currentTreatment"]["target"].rsplit(".", 1)[0]
                    for a in c["attributes"] if a.get("currentTreatment")}))
                    if any(a.get("currentTreatment") for a in c["attributes"]) else c["storage"],
                "estado": status,
                "atributos": len(ar),
                "estados_atributos": counts,
                "relaciones_estados": dict(collections.Counter(r["estado"] for r in related)),
                "migracion": source_line(tab),
                "api_servicio": CATKINDS.get(name, WFKINDS.get(name, name)),
                "permisos": jsonstr(
                    {
                        "table": [t for t in CAT["tables"] if t.get("relname") == tab],
                        "policies": [p for p in CAT["policies"] if p.get("tablename") == tab],
                        "grants": [g for g in CAT["grants"] if g.get("table_name") == tab],
                    }
                ),
                "evidencia": "attribute-matrix.json rows for "
                + name
                + "; native full profile; independent HTTP/RLS/FK/race logs",
                "metodos_uml": next(
                    x["methods"] for x in SRC["official"]["classes"] if x["name"] == name
                ),
                "metodos_evidencia": semantic.get(
                    name,
                    (
                        "BLOQUEADO: exact semantic method→service/test mapping not certified; not an "
                        "assertion of missing "
                        "code"
                    ),
                ),
                "limite": (
                    "Class complete only with all attributes, related associations and explicit "
                    "semantic method evidence; green suites alone never promote "
                    "rows"
                ),
            }
        )
    for row in rows:
        ops = operation_paths(row["clase"])
        row.update({"endpoint_escritura": ops["write"], "endpoint_lectura": ops["read"]})
    save("class-matrix.json", rows)
    csvwrite(
        "HAC-44_matriz_clases.csv",
        [
            {k: jsonstr(v) if isinstance(v, (dict, list)) else v for k, v in row.items()}
            for row in rows
        ],
    )
    return rows


def endpoints():
    """Generate route classifications from the real Hono inventory and HTTP evidence."""
    routes = json.loads((LOGS / "routes-runtime.json").read_text(encoding="utf-8"))
    doc = (OUT / "repro/sources/HAC40_API_ENDPOINTS.md").read_text(encoding="utf-8")
    declared = [
        {"method": m[1], "path": m[2]} for m in re.finditer(r"\| (GET|POST) \| `([^`]+)` \|", doc)
    ]
    assert declared and len({(r["method"], r["path"]) for r in declared}) == len(declared), "Missing or duplicate documented endpoint"
    route_key = lambda r: (r["method"], re.sub(r":[A-Za-z][A-Za-z0-9_]*", ":parameter", r["path"]))
    actual = {route_key(r) for r in routes}
    assert len(actual) == len(routes), "Duplicate runtime route shape"
    assert len({route_key(r) for r in declared}) == len(declared), "Duplicate documented route shape"
    records = []
    for f in (
        "first-api-results.json",
        "api-results.json",
        "extended-api-results.json",
        "ltl-api-results.json",
        "auth-api-results.json",
        "contract-api-results.json",
        "pending-api-results.json",
    ):
        if (LOGS / f).exists():
            records.extend(
                {**r, "file": f, "row": i}
                for i, r in enumerate(json.loads((LOGS / f).read_text(encoding="utf-8")), 1)
            )
    rows = []
    for d in declared:
        pattern = (
            "^" + re.sub(r":[A-Za-z]+", "[^/]+", re.escape(d["path"]).replace("\\:", ":")) + "$"
        )
        matches = [
            r
            for r in records
            if r.get("method") == d["method"]
            and re.match(pattern, "/api/v2" + r.get("path", "").split("?")[0])
        ]
        positive = [
            r
            for r in matches
            if r.get("actor") in (1, 2)
            and r.get("status") == "PASS"
            and r.get("http") in (200, 201)
            and r.get("label")
            not in ("inventory-probe", "proposal-route-presence-probe", "active-auth-control", "revoked-auth-negative")
        ]
        probe = [r for r in matches if r.get("label") == "inventory-probe"]
        anon = [r for r in matches if r.get("actor") == 0 and r.get("http") == 401
                and r.get("status") == "PASS" and r.get("authMechanism") == "anonymous"]
        exists = route_key(d) in actual
        status = (
            "IMPLEMENTADO" if exists and positive and anon else "PARCIAL" if exists else "FALTANTE"
        )
        rows.append(
            {
                "method": d["method"],
                "path": d["path"],
                "estado": status,
                "ruta_codigo": exists,
                "ruta_runtime": jsonstr([r["path"] for r in routes if route_key(r) == route_key(d)]),
                "llamadas": len(matches),
                "positivos": len(positive),
                "anon_401": len(anon),
                "http_probe": sorted(set(r.get("http") for r in probe)),
                "evidencia": jsonstr(
                    [
                        {
                            "file": r["file"],
                            "row": r["row"],
                            "label": r["label"],
                            "http": r.get("http"),
                        }
                        for r in matches
                    ]
                ),
                "limite": (
                    "IMPLEMENTADO means business-positive HTTP + anonymous negative at this "
                    "route; does not certify every field or transition. PARCIAL can mean "
                    "validation/auth exercised but no independent valid "
                    "positive."
                ),
            }
        )
    save("endpoint-matrix.json", rows)
    csvwrite("HAC-44_matriz_endpoints.csv", rows)
    save(
        "endpoint-documentary-delta.json",
        {
            "documented": len(declared),
            "runtime": len(routes),
            "missingFromCode": [r for r in declared if route_key(r) not in actual],
            "undocumented": [r for r in routes if route_key(r) not in {route_key(d) for d in declared}],
            "parameterAliases": [{"method": d["method"], "documentedPath": d["path"], "runtimePath": r["path"]}
                for d in declared for r in routes if route_key(d) == route_key(r) and d["path"] != r["path"]],
        },
    )
    return rows


if __name__ == "__main__":
    a = attributes()
    r = relationships()
    c = classes(a)
    e = endpoints()
    save(
        "matrix-counts.json",
        {
            k: dict(collections.Counter(x["estado"] for x in rows))
            for k, rows in [("classes", c), ("attributes", a), ("relations", r), ("endpoints", e)]
        },
    )
    print(jsonstr(json.loads((LOGS / "matrix-counts.json").read_text(encoding="utf-8"))))
