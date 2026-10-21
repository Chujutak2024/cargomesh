# Nova voice: Vercel + hosted Supabase + AWS staging

This is a deployment runbook, not evidence of a live service. Keep the existing Vercel production branch, root directory, aliases and domains unchanged until the separate rollout decision. Deploy the V2 branch to a fixed staging URL first. The application is under `cargomesh/`; an older Vercel project may still point to `frontend/`.

## Runtime and identity

```text
Browser on HTTPS Vercel site
  -> authenticated POST /api/v2/conversation/voice/session on Vercel
  -> one-use, 45-second signed grant
  -> WSS /voice on AWS ECS Express Mode service URL
  -> Python Strands gateway with ECS task role
  -> Bedrock Nova 2.5 Sonic, us-east-1

Vercel application -> hosted Supabase V2 (auth, RLS, requests, offers)
```

The browser receives no AWS credentials or bridge secret. The Python image is `cargomesh/voice-pilot/Dockerfile.gateway`; it runs as a non-root user and serves `/healthz` on port 8765. The gateway checks the exact browser Origin, grant signature, expiry and replay before accepting audio. A voice connection lasts at most **240 seconds** and each task accepts at most **two** concurrent sessions. The web client renews only after recent speech and retains the local draft across sessions. Voice facts are provisional until validated by the application. Creation, offers and booking still use the authenticated application workflow and explicit confirmation.

## Order of work

1. **Fix the staging target.** In the existing Vercel project, inspect the Git repository, Production Branch, Root Directory and Preview URL. The V2 Next.js root is `cargomesh/`. Do not alter production settings just to repair a preview; use a separate staging project or an approved rollout change. Choose one stable HTTPS staging hostname. A transient commit-preview hostname will not match the gateway's exact Origin after each deployment.
2. **Prepare hosted Supabase.** Apply `supabase-v2/supabase/migrations/` to the intended hosted project, verify RLS and the authenticated V2 intake/offer routes, then create demo identities and authorized scenario data through the documented V2 scenario process. Do not copy local `supabase/scenarios` blindly into production or expose the local synthetic login. On the Free plan, low-activity projects can pause after seven days; confirm the project stays active through judging or arrange a review-day check and resume plan.
3. **Prepare AWS billing and access.** Verify the actual remaining credit, expiry and eligible services in Billing. Create a budget with alerts below the remaining credit and monitor Bedrock usage. Budgets notify; they do not guarantee a spending cap. The current `cargomesh-bedrock` IAM user can invoke Bedrock but receives `AccessDenied` for `ecs:ListClusters` and `apprunner:ListServices`; an AWS administrator must grant deployment permissions or perform provisioning. Do not expand the local user's Bedrock policy into broad admin access.
4. **Build and publish the gateway image.** Build from `cargomesh/voice-pilot` and push a versioned image to private ECR in `us-east-1`. Use the tested commit SHA as the image tag. Run the gateway unit tests and Docker health check first.
5. **Create the voice service.** Prefer ECS Express Mode for this no-domain staging: it provides an `https://<service>.ecs.us-east-1.on.aws/` URL with TLS and an ALB. Configure container port `8765`, health path `/healthz`, a single task (`min=1`, `max=1`) initially, and the image above. Override the container command with `--deploy --host 0.0.0.0 --port 8765 --origin https://<stable-vercel-staging-host>`. Use a task role scoped to `bedrock:InvokeModel` on `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-5-sonic`. The separate execution role pulls ECR, writes logs and retrieves the secret. Do not put an IAM access key or `AWS_BEARER_TOKEN_BEDROCK` in the task. Confirm the managed ALB's WebSocket path and idle timeout allow a 240-second session; test a real connection before leaving the service running. Keep max tasks at one until replay tracking and session admission move out of process memory.
6. **Share one bridge secret securely.** Generate a fresh random value of at least 32 bytes. Store it in AWS Secrets Manager and inject it as `CARGOMESH_VOICE_BRIDGE_SECRET` into the ECS task. Set the same value in Vercel as a server-only environment variable. Do not commit it, place it in `NEXT_PUBLIC_*`, copy `.env.local` into Vercel or send it through chat. Rotating this value requires a new ECS task and Vercel deployment and invalidates outstanding grants.
7. **Configure Vercel staging.** Set `CARGOMESH_VOICE_WS_URL=wss://<service>.ecs.us-east-1.on.aws/voice`, `CARGOMESH_VOICE_BRIDGE_SECRET` and `NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW=true` for the selected staging deployment. Configure the hosted Supabase URL, publishable/anon key and server secrets through Vercel's environment settings, using the application's `.env.example` as the variable inventory. Do not set `CARGOMESH_NOVA_DEMO_VOICE` in production. Redeploy after changing `NEXT_PUBLIC_*` values because they are build-time values.
8. **Validate before leaving it online.** Check ECS `/healthz`, Vercel build and hosted login. Speak on the shipper and carrier screens; verify microphone, transcript, pause/resume, opportunity scope, draft review and explicit mutations. Verify anonymous access, wrong Origin and replayed grants fail. Check CloudWatch for session failures without logging audio, identity or tokens. Confirm actual AWS charges after a short real session and verify the budget alerts reach the owner. Check a second browser/device and a fresh day before calling staging available for judges.

## Cost and shutdown

**Availability deadline: 2026-12-03 (America/Lima).** The shared staging service should be available through the judging period, but no later than December 3. Schedule a reminder before that date and a shutdown check on December 3; a budget alert does not shut infrastructure down. If an automatic cutoff is desired, configure and test a scheduled AWS shutdown separately before relying on it.

Vercel and Supabase Free plans are separate from AWS credit. ECS Express Mode has no separate Express fee, but its Fargate task, ALB, public networking, ECR, logs, Secrets Manager and Bedrock usage can incur charges while it is on. At `us-east-1` rates, an ALB alone has a $0.0225/hour base (about $16.20 for 30 days) plus LCUs; a continuously running Fargate task and other resources add to that. Calculate a 30- and 60-day estimate in AWS Pricing Calculator **before** provisioning; do not treat the remaining $150 credit as a cap or assume every charge is credit-eligible. Nova inference varies with actual audio and token usage. The budget must reserve room for infrastructure and model calls.

At the end of judging, **delete the Express service**, then verify its ALB, target group, public IPs and tasks are gone; merely setting the task count to zero may leave the ALB bill running. Remove the Vercel voice flag and redeploy, then delete the ECR image/repository and bridge secret if no longer needed. Confirm in Billing/Cost Explorer that charges stop; turning off the browser button alone does not stop infrastructure charges. Keep a daily health/cost check while staging is public.

## Current blockers (2026-10-18)

- No Vercel project is linked in this checkout and the Vercel CLI is not installed. The owner has confirmed Vercel access but no custom domain; the AWS-managed Express hostname avoids a domain purchase.
- The local AWS profile is valid for Bedrock but lacks ECS/App Runner deployment permissions. No AWS service, ECR image, secret or Vercel setting has been created or changed by this runbook.
- The current Vercel project's Git/Root Directory and the intended hosted Supabase project must be inspected before selecting the stable staging URL and binding the gateway Origin.
