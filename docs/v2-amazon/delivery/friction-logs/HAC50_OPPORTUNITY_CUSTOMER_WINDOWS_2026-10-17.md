# HAC-50 — Carrier opportunity projection lacks customer time windows

Date: 2026-10-17, America/Lima.

## Evidence

Authenticated Carrier reads returned 4 opportunities. All include planned resource windows, none includes customer pickup/delivery windows. The opportunity schema requires assignment snapshots and responseDeadline, without guaranteeing those customer fields. A Carrier-only account cannot obtain them by reading the private Client request endpoint.

## Current handling

The connected Requests detail explicitly marks those customer windows as not included. Planned resource windows and the response deadline are labelled separately. No time is reconstructed from route duration or local examples. The customer request remains read-only; review acceptance is not a transport commitment.

## Required follow-up

Coordinate with the Client/C6 owner to expose an authorized minimized opportunity snapshot with authoritative pickup/delivery windows, timezone context and source request revision. Preserve scope/version evidence. This task does not modify the shared SQL projection, migrations or Client APIs.

Native test data is already OFFERED, so real review response validation also needs a deliberately open opportunity in an authorized test scenario. Responses were tested with controlled HTTP replies; no live opportunities were mutated.
