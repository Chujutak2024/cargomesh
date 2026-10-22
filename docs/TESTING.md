# Testing and reproducibility

Run from the repository root after installing the locked application dependencies. The scripts in `cargomesh/package.json` and `.github/workflows/v2-qa-gate.yml` define the current gate; avoid using historical test totals as acceptance criteria.

```sh
pnpm --dir cargomesh release:verify
```

That command runs type checking, architecture checks, workspace/demo, release, conversational/workflow, carrier-commercial and logistics tests, then a production build. Focused checks are also available:

```sh
pnpm --dir cargomesh test:mcp
pnpm --dir cargomesh test:v2-conversation
pnpm --dir cargomesh test:v2-chat-workflow
pnpm --dir cargomesh test:carrier-closeout
pnpm --dir cargomesh test:client-operations
python scripts/check-v2-full-model.py
python scripts/build-v2-full-der.py --check
```

After installing gateway dependencies, from `cargomesh/voice-pilot/`:

```sh
python -m unittest test_gateway_packaging test_nova_voice_gateway test_voice_guidance test_voice_transport_limits test_voice_response_finish
```

The GitHub gate separately runs SQL V1 regression, V2 clean bootstrap/drift/pgTAP, authenticated HTTP workflow and real local OAuth PKCE/MCP smoke. With Docker running, isolated local SQL profiles can be reproduced from the root (choose an evidence directory outside Git):

```sh
python supabase-v2/gate.py manifest --evidence-dir /tmp/cargomesh-qa/manifest
python supabase-v2/gate.py v2 --evidence-dir /tmp/cargomesh-qa/v2
```

On Windows replace `/tmp/cargomesh-qa` with a path under `$env:TEMP`. The V2 gate resets its named local project and reference containers; preserve any local data you need first. See the [bootstrap reference](v2-amazon/delivery/HAC29_CLEAN_BOOTSTRAP.md).

## Acceptance outside automated tests

- Open both native workspaces with authorized identities; check cross-tenant rejection and disabled-feature behavior.
- Complete customer draft → correction/review → explicit request action using synthetic data.
- Inspect a carrier opportunity/offer and booking; confirm financial semantics, role-scoped costs and no fake availability.
- Exercise typed Nova audio, a long reply, microphone, mute and reconnect on the deployed image.
- Verify exact hosted migrations/scenario, source deployment and image digest separately.

Unit tests and CI are not evidence of a human conversation, physical Alexa device, hosted SQL application or real carrier integration. Record the environment and commit with any result.
