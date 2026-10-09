"""Fail-closed local bank identity and configurable TCP layout.

The marker is public provenance, never a credential. A database marker survives
HTTP restarts; reset is permitted only after all three ownership checks pass.
"""

import json
import os
import re
import socket
import subprocess
import tomllib
import uuid
from dataclasses import dataclass
from pathlib import Path

from common import OUT, run, save, write


class BankAbort(RuntimeError):
    pass


@dataclass(frozen=True)
class Layout:
    project_prefix: str
    port_base: int

    def __post_init__(self):
        if not re.fullmatch(r"[a-z][a-z0-9-]{2,48}", self.project_prefix):
            raise BankAbort("An explicit local project prefix is required")
        if not 1024 <= self.port_base <= 65200:
            raise BankAbort("Port base must leave room for three disjoint banks")

    @classmethod
    def environment(cls):
        try:
            return cls(os.environ["HAC44_PROJECT_PREFIX"], int(os.environ["HAC44_PORT_BASE"]))
        except (KeyError, ValueError) as error:
            raise BankAbort("Set HAC44_PROJECT_PREFIX and HAC44_PORT_BASE explicitly") from error

    def project(self, kind):
        return self.project_prefix + "-" + kind

    def base(self, kind):
        return self.port_base + {"v2": 0, "v1": 100, "baseline": 200}[kind]

    @property
    def app_port(self):
        return self.port_base + 90

    @property
    def api_url(self):
        return "http://127.0.0.1:" + str(self.port_base + 1)


def ports(config, prefix=""):
    result = {}
    for key, value in config.items():
        name = prefix + key
        if isinstance(value, dict):
            result.update(ports(value, name + "."))
        elif key == "port" or key.endswith("_port"):
            if type(value) is not int or not 1024 <= value <= 65535:
                raise BankAbort("Invalid TCP port: " + name)
            result[name] = value
    return result


def configure(source, project, base):
    """Assign every active TOML port by its setting, including disabled services."""
    offsets = {"api.port": 1, "db.port": 2, "db.shadow_port": 0,
               "db.pooler.port": 9, "studio.port": 3, "inbucket.port": 4,
               "inbucket.smtp_port": 5, "inbucket.pop3_port": 6,
               "analytics.port": 7, "local_smtp.port": 8, "edge_runtime.inspector_port": 10}
    section = ""
    lines = []
    for line in source.splitlines():
        match = re.match(r"\s*\[([^]]+)\]", line)
        if match:
            section = match[1]
        field = re.match(r"(\s*)(\w+)\s*=", line)
        if field and field[2] == "project_id" and not section:
            line = 'project_id = ' + json.dumps(project)
        elif field and (field[2] == "port" or field[2].endswith("_port")):
            setting = section + "." + field[2]
            if setting not in offsets:
                raise BankAbort("Unreviewed local TCP setting: " + setting)
            line = field[1] + field[2] + " = " + str(base + offsets[setting])
        lines.append(line)
    result = "\n".join(lines) + "\n"
    parsed = tomllib.loads(result)
    if parsed["project_id"] != project or len(set(ports(parsed).values())) != len(ports(parsed)):
        raise BankAbort("Invalid project or overlapping bank ports")
    return result


def excluded_ranges(output):
    return [(int(a), int(b)) for a, b in re.findall(r"^\s*(\d+)\s+(\d+)\s*(?:\*)?\s*$", output, re.M)]


def preflight(configs, app_port, excluded=None):
    claimed = {}
    for config in configs:
        for setting, port in ports(config).items():
            if port in claimed:
                raise BankAbort("TCP layout overlap: " + str(port))
            claimed[port] = config["project_id"] + ":" + setting
    if app_port in claimed:
        raise BankAbort("HTTP runner overlaps a bank")
    claimed[app_port] = "HTTP runner"
    if excluded is None:
        if os.name == "nt":
            result = run("bank-excluded-ports", ["netsh", "interface", "ipv4", "show", "excludedportrange", "protocol=tcp"])
            if result.returncode:
                raise BankAbort("Cannot verify Windows excluded TCP ranges")
            excluded = excluded_ranges(result.stdout)
        else:
            excluded = []
    for port, setting in claimed.items():
        if any(start <= port <= end for start, end in excluded):
            raise BankAbort("Reserved TCP port: " + str(port) + " " + setting)
        for family, host in [(socket.AF_INET, "0.0.0.0")] + ([(socket.AF_INET6, "::")] if socket.has_ipv6 else []):
            try:
                with socket.socket(family, socket.SOCK_STREAM) as probe:
                    if os.name == "nt":
                        probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                    if family == socket.AF_INET6:
                        probe.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
                    probe.bind((host, port))
                    probe.listen(1)
            except OSError as error:
                raise BankAbort("Occupied TCP port: " + str(port) + " " + setting) from error
    return {"ports": claimed, "excludedRanges": excluded, "status": "PASS"}


class Bank:
    def __init__(self, folder, project, execute=run):
        self.folder, self.project, self.execute = Path(folder).resolve(), project, execute
        self.db = "supabase_db_" + project
        self.marker = self.folder / "ownership.json"

    def config(self):
        config = tomllib.loads((self.folder / "supabase/config.toml").read_text(encoding="utf-8-sig"))
        if config.get("project_id") != self.project:
            raise BankAbort("Foreign project in config.toml")
        return config

    def resources(self):
        trace = uuid.uuid4().hex
        result = self.execute("bank-resources-" + self.project + "-" + trace,
            ["docker", "ps", "-a", "--filter", "label=com.supabase.cli.project=" + self.project,
             "--format", "{{.ID}}"])
        if result.returncode:
            raise BankAbort("Cannot inspect local Docker resources")
        ids = result.stdout.split()
        if not ids:
            return []
        result = self.execute("bank-labels-" + self.project + "-" + trace,
            ["docker", "inspect", "--format",
             '{"id":{{json .Id}},"name":{{json .Name}},"project":{{json (index .Config.Labels "com.supabase.cli.project")}}}', *ids])
        if result.returncode:
            raise BankAbort("Cannot inspect local Docker labels")
        return [json.loads(line) for line in result.stdout.splitlines() if line.startswith("{")]

    def raw_sql(self, label, query):
        return self.execute(label, ["docker", "exec", "-i", self.db, "psql", "-X", "-A", "-t",
            "-v", "ON_ERROR_STOP=1", "-v", "local_only=1", "-U", "postgres", "-d", "postgres"], data=query)

    def own(self, operation):
        trace = uuid.uuid4().hex
        config = self.config()
        if not self.marker.is_file():
            raise BankAbort("Missing own bank marker; ABORT " + operation)
        marker = json.loads(self.marker.read_text(encoding="utf-8"))
        if marker.get("project") != self.project or marker.get("folder") != str(self.folder) or not marker.get("id"):
            raise BankAbort("Foreign own bank marker; ABORT " + operation)
        resources = self.resources()
        if not resources or any(r.get("project") != self.project for r in resources):
            raise BankAbort("Foreign or absent container labels; ABORT " + operation)
        if not any(r["name"] == "/" + self.db for r in resources):
            raise BankAbort("Own database container is absent; ABORT " + operation)
        result = self.raw_sql("bank-marker-check-" + self.project + "-" + trace,
            "select id::text from hac44_bank.ownership where project=" + "'" + self.project + "';")
        if result.returncode or result.stdout.strip() != marker["id"]:
            raise BankAbort("Database own marker is absent or foreign; ABORT " + operation)
        save("ownership-" + self.project + "-" + operation + "-" + trace + ".json",
             {"status": "PASS", "operation": operation, "project": config["project_id"],
              "marker": marker["id"], "containers": resources})
        return marker

    def install_marker(self, marker):
        self.config()
        resources = self.resources()
        if (not resources or any(row.get("project") != self.project for row in resources)
                or not any(row["name"] == "/" + self.db for row in resources)):
            raise BankAbort("Cannot prove newly started container labels; do not create a marker")
        result = self.raw_sql("bank-marker-create-" + self.project,
            "create schema if not exists hac44_bank; create table if not exists hac44_bank.ownership(id uuid primary key,project text not null);"
            + "insert into hac44_bank.ownership values('" + marker["id"] + "','" + self.project + "') on conflict(id) do nothing;")
        if result.returncode:
            raise BankAbort("Cannot create own marker; preserve bank for diagnosis")
        write(self.marker, json.dumps(marker, indent=2) + "\n")
        self.own("initialized")

    def start_new(self, cli):
        self.config()
        if self.marker.exists() or self.resources():
            raise BankAbort("A fresh bank cannot reuse a project or marker")
        # Names are used only to reject collisions, never to establish ownership.
        result = self.execute("bank-existing-volumes-" + self.project, ["docker", "volume", "ls", "--format", "{{.Name}}"])
        if result.returncode or any(name.endswith("_" + self.project) for name in result.stdout.split()):
            raise BankAbort("Pre-existing project volume; ABORT without touching it")
        result = self.execute("bank-existing-names-" + self.project, ["docker", "ps", "-a", "--format", "{{.Names}}"])
        if result.returncode or any(name.endswith("_" + self.project) for name in result.stdout.split()):
            raise BankAbort("Pre-existing container name; ABORT without touching it")
        marker = {"id": str(uuid.uuid4()), "project": self.project, "folder": str(self.folder)}
        result = self.execute("bank-start-" + self.project, cli + ["db", "start", "--workdir", self.folder], timeout=900)
        if result.returncode:
            raise BankAbort("Own bank start failed; inspect resources before any cleanup")
        self.install_marker(marker)

    def reset(self, cli):
        marker = self.own("reset")
        result = self.execute("bank-backup-" + self.project,
            ["docker", "exec", self.db, "pg_dump", "-U", "postgres", "--data-only", "--schema=public", "--schema=private", "postgres"])
        if result.returncode:
            raise BankAbort("Cannot back up own bank before reset")
        write(OUT / "backups" / (self.project + "-before-reset.sql"), result.stdout)
        result = self.execute("bank-reset-" + self.project, cli + ["db", "reset", "--local", "--yes", "--workdir", self.folder], timeout=900)
        if result.returncode:
            raise BankAbort("Own reset failed; marker must be re-established before cleanup")
        self.install_marker(marker)

    def stop(self, cli):
        self.own("stop")
        result = self.execute("bank-stop-" + self.project, cli + ["stop", "--workdir", self.folder], timeout=900)
        if result.returncode or self.resources():
            raise BankAbort("Own bank did not stop cleanly")
