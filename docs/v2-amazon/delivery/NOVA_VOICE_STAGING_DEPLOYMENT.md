# Nova voice: shared staging deployment

The browser voice pilot can run on a shared HTTPS staging site after the separate Python gateway is deployed. This is a deployment recipe, not evidence that the gateway is live. Nova speech is guidance only. The user can explicitly copy the last recognized spoken message into the editable request composer and send it through the existing authenticated chat API; typed chat remains the workflow that edits or saves freight requests. Alexa+ is a separate channel.

## Components

1. The existing Next.js site calls `/api/v2/conversation/voice/session`. For an authenticated, active organization member it signs a 45-second, one-use grant. No AWS credentials go to the browser.
2. The browser opens `wss://<voice-host>/voice` and sends that grant before audio. The gateway checks the exact web `Origin`, token signature, issuer, audience, expiration and replay, then streams PCM to Bedrock Nova 2.5 Sonic through Strands. A session is capped at 90 seconds and the gateway admits at most two simultaneous sessions per task.
3. The gateway container listens on HTTP port 8765 inside a private network. An HTTPS load balancer with an ACM certificate terminates TLS/WSS; its target-group health path is `/healthz`. Only the load balancer security group may reach the container. Do not expose port 8765 publicly.

## Staging setup

- Build `cargomesh/voice-pilot/Dockerfile.gateway` and push the image to a private ECR repository. The container runs as a non-root user. Deploy **one ECS Fargate task** initially: grant replay tracking and the two-session cap are in memory and cannot be shared across tasks yet.
- Give that **task role** only `bedrock:InvokeModel` on `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-5-sonic`. Keep the ECS execution role separate for ECR/image pulls and secret delivery. Set `AWS_REGION=us-east-1` on the task. Do not create or place a long-lived AWS access key or Bedrock API key in the container.
- Generate a unique random `CARGOMESH_VOICE_BRIDGE_SECRET` of at least 32 bytes and store it in AWS Secrets Manager. Inject it into the ECS task securely; configure the identical value as a **server-only** secret for the Next.js deployment. Do not commit it or prefix it with `NEXT_PUBLIC_`. Rotating it invalidates outstanding voice grants; redeploy the task to pick up the new value.
- Set the container arguments to `--deploy --host 0.0.0.0 --port 8765 --origin https://<staging-web-host>`. The exact origin must match the web page, including a non-default port if any. `--deploy` refuses HTTP origins, a local AWS profile, and loopback binding.
- Configure the load balancer's HTTPS listener and WebSocket upgrade support, health check `GET /healthz`, and idle timeout longer than the 90-second voice session. Map `wss://<voice-host>/voice` to the gateway target. Point the voice DNS name to that listener. Ensure the browser site is HTTPS so microphone access works.
- In the **staging web deployment**, set `CARGOMESH_VOICE_WS_URL=wss://<voice-host>/voice`, the matching server-only bridge secret, and `NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW=true` **before building** the Next.js bundle. Do not set `CARGOMESH_NOVA_DEMO_VOICE`; synthetic preview grants are blocked in production builds. Users must sign in with an active CargoMesh membership.
- Allow requests from the staging web origin to the voice host. The browser uses a WebSocket; no AWS key or bearer token is embedded in the frontend bundle. Review CSP `connect-src` if the hosting site sets one.

Staging validation: check that the load balancer reports `/healthz` healthy; then sign in on the staging site and speak. Confirm user and assistant transcript appears while Nova speaks. An anonymous user, a foreign `Origin`, and a reused/expired grant must fail. Validate mobile microphone and interruption behavior with a human. Stop after a short session and verify Bedrock usage and AWS billing. Keep the feature flag off on production until these checks, cost limits and the CargoMesh workflow gates pass.

ECS Fargate, the HTTPS load balancer, public DNS, Secrets Manager and Bedrock inference can all incur charges even without many voice calls. Configure AWS Budgets and CloudWatch alarms before leaving the staging service running. This repository does not provision those resources or alter Vercel production settings. A separate infrastructure and rollout decision is required for activation.

## Local development

The existing `start-nova-gateway.ps1` keeps the bridge on loopback and uses the local `cargomesh-bedrock` AWS profile. The deployed container uses temporary IAM task-role credentials instead. Keep `.env.local` ignored and local; share configuration names and setup steps with teammates, never its secret values.
