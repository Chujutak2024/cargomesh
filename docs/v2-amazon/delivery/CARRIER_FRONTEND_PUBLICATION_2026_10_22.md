# Carrier presentation and commercial refresh — 2026-10-22

## Authorized delivery

The owner requested publishing the recent local Fleet/Commercial work to main and Vercel, preserving Luis's landing and workspace transitions. This explicitly authorizes this integration despite the default main freeze. No Linear changes, new hosted fixtures, migrations, or commercial mutations are included.

Luis's `72ec132` is already on main, not an outstanding PR. Source review confirms separate Carrier truck/Client bars loaders, route-driven completion, reduced-motion handling, delayed recovery actions, existing demo session guards and third-party notices. His reported 43 tests and TypeScript result remain attributed to his delivery; they were not rerun locally.

## Changes

- Fleet directory defaults to all authorized resources and filters by recorded capacity/type. Drivers/Scheduling read all authorized ROAD services independently of truck filters; writes still use each record's service and native ADMIN permissions.
- Stable cached truck stills replace individual directory rendering loops. Card, summary and record reuse the selected design; original vehicle types are not invented from decorative designs.
- Accepted compact truck summary/card layouts and current opportunity/offer directories are included. Driver labels distinguish usual from trip assignment and keep unknown experience/availability unknown.
- Shared display aliases shorten current demo requests, offers, bookings, reservations, trucks and operations. UUIDs remain API identities. Technical cargo labels are cleaned using the recorded category; C01 synthetic endpoints are explicitly named points rather than fabricated cities. The fallback label is not a new globally unique business identifier.
- Pipeline labels now use the same aliases. Its active visible view refreshes opportunities/offers/bookings/executions together every 30 seconds, with one request group in flight, cancellation and no refresh during a commercial write. No booking state is changed by polling.
- Map framing/site context adjustments preserve the distinction between site locations, recorded operation positions and live GPS. Current main Tracking corridor/scope guards are retained when consolidating the older local preview.

The scenario file is a declarative SELECT manifest of already authorized synthetic usual-driver links. It does not activate data or run during deployment.

## Evidence and limitations

Read-only production comparison on October22 at18:34UTC confirmed identical C01 opportunity/offer/booking IDs, versions and states from Client and Carrier identities:1 opportunity,2 offer versions,2 booking attempts. The current booking is CONFIRMED/AUTHORIZED at USD361.20; its execution remains PLANNED. The cancelled attempt is retained. Older fixtures populate other pipeline stages and are not new customer sales.

No local tests, typecheck, build or visual review were run, following the owner's instruction. Existing hosted CI and Vercel deployment automation remain configured normally. This publication is not a new end-to-end order creation or a claim that the owner reviewed every screen. No transport was started.

Local sanitized detail: `salida/demo-identidad-20261022/CONEXION-COMERCIAL.md`, `ROTULOS-COMERCIALES.md`, `RELACIONES.md`, `TARJETAS.md`, and `DRIVERS-SCHEDULING.md`.
