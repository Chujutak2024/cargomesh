"""Packaging regression: COPY inputs must survive the explicit Docker context allowlist."""
from pathlib import Path
import fnmatch
import shlex
import unittest

ROOT=Path(__file__).parent

def included(name):
    allow=True
    for line in (ROOT/'.dockerignore').read_text().splitlines():
        line=line.strip()
        if not line or line.startswith('#'):
            continue
        negate=line.startswith('!');pattern=line[1:] if negate else line
        if fnmatch.fnmatchcase(name,pattern):
            allow=negate
    return allow

class GatewayPackagingTests(unittest.TestCase):
    def test_every_declared_copy_input_exists_and_is_allowed(self):
        for line in (ROOT/'Dockerfile.gateway').read_text().splitlines():
            if line.startswith('COPY '):
                for name in shlex.split(line)[1:-1]:
                    with self.subTest(source=name):
                        self.assertTrue((ROOT/name).is_file())
                        self.assertTrue(included(name))

    def test_private_files_and_test_fixtures_stay_out(self):
        for name in ['.env','.env.local','credentials.json','supabase.private.json','test_nova_voice_gateway.py']:
            with self.subTest(source=name):
                self.assertFalse(included(name))
