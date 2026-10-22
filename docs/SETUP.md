# Setup and local execution

## Requirements

Use the CI-pinned Node **24.20.0** and pnpm **11.19.0**. Python 3.11+ and Docker are needed for database QA; the gateway image uses Python 3.12. Supabase CLI is pinned to **2.117.0** in the local gate. Do not rely on a particular developer's port, launcher or linked `node_modules`.

```sh
git clone https://github.com/Chujutak2024/cargomesh.git
cd cargomesh
pnpm --dir cargomesh install --frozen-lockfile
```

Copy `cargomesh/.env.example` to the ignored `cargomesh/.env.local`. Set your Supabase V2 URL and publishable/anon key. Use only the server variables required by enabled features; placeholders are not functional credentials. See [configuration](CONFIGURATION.md).

## Local database

The V2 chain is `supabase-v2/supabase/migrations/`. These commands start/reset only the selected **local** project. A reset discards that project's local data; do not point it at shared/hosted data.

```sh
npx --yes supabase@2.117.0 start --workdir supabase-v2
npx --yes supabase@2.117.0 db reset --local --workdir supabase-v2
```

The configured local API is `http://127.0.0.1:58321`; obtain the local publishable key from the local CLI status. Global synthetic seeding is disabled. Select an explicit [scenario](DATA.md), follow its prerequisites and run its verification before testing. The clean SQL QA gate automates isolated replay; see [testing](TESTING.md) and [bootstrap details](v2-amazon/delivery/HAC29_CLEAN_BOOTSTRAP.md).

## Run the application

```sh
pnpm --dir cargomesh dev
```

Open `http://localhost:3000/`, then `/clients` or `/carriers`. Connected access needs an active organization member or carrier operator. Create/provision synthetic test identities through the chosen scenario and authorized local administration; never assume a fresh database includes a usable judge account.

Optional assigned demo sessions require explicit flags, fixed server-owned synthetic credentials and exact origin checks. Local automatic workspace access has a strict loopback policy (8080 for local Supabase; the separately enabled hosted-local development preview uses 8090). Changing the HTTP port does not automatically authorize demo login. Normal authenticated access remains available without that convenience mode.

For a local production build:

```sh
pnpm --dir cargomesh build
pnpm --dir cargomesh start
```

Restart after environment changes; rebuild for `NEXT_PUBLIC_*` changes. Optional maps require Google configuration. Optional Nova needs an independent [voice gateway](VOICE.md). No AWS deployment, hosted migration or scenario loading happens from `pnpm dev`.
