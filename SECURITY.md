# Security

Do not post exploitable vulnerabilities, credentials, session grants, access tokens, private data or raw voice recordings in public issues. Use GitHub's private vulnerability reporting for this repository if enabled; otherwise contact the repository owner privately through an already established channel. No response-time guarantee is implied.

Report the affected revision/component, sanitized reproduction, expected isolation boundary and impact. Do not test against another tenant or a real commercial booking without authorization.

CargoMesh relies on authenticated organization/carrier scope, Supabase RLS, explicit commercial confirmations, expected versions and idempotency. Nova grants are short lived and one use; the gateway checks Origin and bounds input. Those controls must not be disabled to obtain a successful demo. Configure runtime secrets through server environment/Secrets Manager, never browser variables or committed `.env` files. Optional synthetic demo access must remain exact-origin and server-owned.
