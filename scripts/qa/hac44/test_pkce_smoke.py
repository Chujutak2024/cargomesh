"""Exercise complete CLI transport with a local executable, never npx downloads."""
import ast
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace, ModuleType
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SENTINELS = ('FAKE_SERVICE_KEY_DO_NOT_LOG', 'FAKE_ANON_KEY_DO_NOT_LOG', 'FAKE_PASSWORD_DO_NOT_LOG')


def selected_cli(executable=None, platform=os.name):
    """Evaluate only the production CLI selection, without bank/module side effects."""
    tree = ast.parse((HERE / 'local.py').read_text(encoding='utf-8'))
    assignments = [node for node in tree.body if isinstance(node, ast.Assign)
                   and any(isinstance(target, ast.Name) and target.id in ('cli', 'CLI') for target in node.targets)]
    namespace = {'os': SimpleNamespace(name=platform, environ={'HAC44_CLI': executable} if executable else {}),
                 'shutil': SimpleNamespace(which=lambda _: None)}
    exec(compile(ast.Module(body=assignments, type_ignores=[]), 'local.py CLI selection', 'exec'), namespace)
    return namespace['CLI']


class CliTransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory(prefix='hac44-cli-stub-')
        cls.directory = Path(cls.folder.name)
        cls.stub = cls.directory / ('cli stub.exe' if os.name == 'nt' else 'cli stub')
        if os.name == 'nt':
            compiler = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
            if not compiler.exists():
                raise RuntimeError('Local .NET compiler required for executable stub; no downloads allowed')
            source = cls.directory / 'Stub.cs'
            source.write_text('''using System;
using System.IO;
class Stub {
  static int Main(string[] args) {
    File.WriteAllLines(Environment.GetEnvironmentVariable("HAC44_STUB_ARGV"), args);
    string mode = Environment.GetEnvironmentVariable("HAC44_STUB_MODE");
    string data = "{\\\"API_URL\\\":\\\"http://127.0.0.1:64001\\\",\\\"SERVICE_ROLE_KEY\\\":\\\"FAKE_SERVICE_KEY_DO_NOT_LOG\\\",\\\"ANON_KEY\\\":\\\"FAKE_ANON_KEY_DO_NOT_LOG\\\",\\\"password\\\":\\\"FAKE_PASSWORD_DO_NOT_LOG\\\"}";
    Console.WriteLine(mode == "malformed" ? "INVALID FAKE_SERVICE_KEY_DO_NOT_LOG" : data);
    if (mode == "failure") { Console.Error.WriteLine(data); return 7; }
    return 0;
  }
}''', encoding='utf-8')
            compiled = subprocess.run([str(compiler), '/nologo', '/out:' + str(cls.stub), str(source)],
                                      capture_output=True, text=True)
            if compiled.returncode:
                raise RuntimeError('Local executable stub compilation failed')
        else:
            cls.stub.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
Path(os.environ['HAC44_STUB_ARGV']).write_text('\\n'.join(sys.argv[1:])+'\\n')
mode=os.environ.get('HAC44_STUB_MODE')
data=json.dumps(dict(API_URL='http://127.0.0.1:64001',SERVICE_ROLE_KEY='FAKE_SERVICE_KEY_DO_NOT_LOG',ANON_KEY='FAKE_ANON_KEY_DO_NOT_LOG',password='FAKE_PASSWORD_DO_NOT_LOG'))
print('INVALID FAKE_SERVICE_KEY_DO_NOT_LOG' if mode=='malformed' else data)
if mode=='failure':
    print(data,file=sys.stderr)
    sys.exit(7)
''', encoding='utf-8')
            cls.stub.chmod(0o700)
        cls.driver = cls.directory / 'driver.mjs'
        cls.driver.write_text('''import assert from 'node:assert/strict';
const {readCliStatus} = await import(process.env.HAC44_TEST_MODULE);
try {
  const status = readCliStatus(process.env.HAC44_CLI_JSON, process.env.HAC44_BANK_FOLDER);
  assert.equal(process.env.HAC44_EXPECT_ERROR, undefined);
  assert.equal(status.API_URL, 'http://127.0.0.1:64001');
  assert.ok(status.SERVICE_ROLE_KEY && status.ANON_KEY);
} catch (error) {
  assert.equal(error.message, process.env.HAC44_EXPECT_ERROR);
}
console.log('PASS CLI transport');
''', encoding='utf-8')

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def execute_stub(self, prefix=(), mode='success', error=None, command=None):
        record = self.directory / 'received-argv.txt'
        record.unlink(missing_ok=True)
        bank = str(self.directory / 'owned bank')
        env = os.environ.copy()
        env.update(HAC44_TEST_MODULE=(HERE / 'pkce_smoke.mjs').as_uri(),
                   HAC44_CLI_JSON=json.dumps(command if command is not None else [str(self.stub), *prefix]),
                   HAC44_BANK_FOLDER=bank, HAC44_STUB_ARGV=str(record), HAC44_STUB_MODE=mode)
        env.pop('HAC44_EXPECT_ERROR', None)
        if error:
            env['HAC44_EXPECT_ERROR'] = error
        argv = ['node', str(self.driver)]
        result = subprocess.run(argv, env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), 'PASS CLI transport')
        self.assertEqual(result.stderr, '')
        recorded = record.read_text().splitlines() if record.exists() else []
        for sentinel in SENTINELS:
            self.assertNotIn(sentinel, json.dumps(argv) + json.dumps(recorded) + result.stdout + result.stderr)
        if command is None:
            self.assertEqual(recorded, [*prefix, 'status', '--workdir', bank, '-o', 'json'])
        return recorded

    def test_direct_cli_executable_with_spaces(self):
        self.assertEqual(selected_cli(str(self.stub)), [str(self.stub)])
        self.execute_stub()

    def test_pinned_npx_fallback_argv(self):
        self.execute_stub()  # Real positive control in the same test.
        for platform, executable in [('nt', 'npx.cmd'), ('posix', 'npx')]:
            with self.subTest(platform=platform):
                command = selected_cli(platform=platform)
                self.assertEqual(command, [executable, '--yes', 'supabase@2.117.0'])
                # Replace only the executable: the fallback tail reaches a real child unchanged.
                self.execute_stub(prefix=command[1:])

    def test_failed_status_does_not_leak_stdout_or_stderr(self):
        self.execute_stub()
        self.execute_stub(mode='failure', error='Local status failed')

    def test_malformed_status_does_not_leak_parser_input(self):
        self.execute_stub()
        self.execute_stub(mode='malformed', error='Invalid local status response')

    def test_invalid_command_aborts_before_spawn(self):
        self.execute_stub()
        for command in ([], [''], [str(self.stub), 42], {'cmd': str(self.stub)}):
            with self.subTest(command=command):
                self.assertEqual(self.execute_stub(command=command, error='Invalid local CLI command'), [])

    def test_python_bridge_transmits_complete_direct_and_fallback_commands(self):
        for command in (selected_cli(str(self.stub)), selected_cli(platform='nt')):
            with self.subTest(command=command):
                logs, saved, resets = [], [], []
                common = ModuleType('common')
                common.ROOT = self.directory
                common.OUT = self.directory
                common.save = lambda *args: saved.append(args)
                common.write = lambda *args: logs.append(args)
                common.safe = lambda value: value
                local = ModuleType('local')
                local.CLI = command
                local.HARNESS = self.directory / 'owned bank'
                local.LAYOUT = SimpleNamespace(api_url='http://127.0.0.1:64001', app_port=64090)
                local.BANK = SimpleNamespace(db='supabase_db_owned', own=lambda _: None,
                    reset=lambda cli: resets.append(cli),
                    raw_sql=lambda *args: SimpleNamespace(returncode=0, stdout='0'))
                spec = importlib.util.spec_from_file_location('pkce_bridge_under_test', HERE / 'pkce_smoke.py')
                module = importlib.util.module_from_spec(spec)
                def child(argv, **kwargs):
                    self.assertEqual(argv, ['node', (HERE / 'pkce_smoke.py').with_suffix('.mjs')])
                    self.assertEqual(json.loads(kwargs['env']['HAC44_CLI_JSON']), command)
                    for sentinel in SENTINELS:
                        self.assertNotIn(sentinel, str(argv))
                    return SimpleNamespace(returncode=0,
                        stdout='FAKE_SERVICE_KEY_DO_NOT_LOG\nPKCE_RESULT:{"status":"PASS"}\n', stderr='')
                with patch.dict('sys.modules', {'common': common, 'local': local}):
                    spec.loader.exec_module(module)
                with patch.object(module.subprocess, 'run', side_effect=child), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(module.main(), 0)
                self.assertEqual(resets, [command])
                self.assertEqual(saved[0][1]['cleanupAuthUsers'], 0)
                for sentinel in SENTINELS:
                    self.assertNotIn(sentinel, str(logs) + str(saved))


if __name__ == '__main__':
    unittest.main()
