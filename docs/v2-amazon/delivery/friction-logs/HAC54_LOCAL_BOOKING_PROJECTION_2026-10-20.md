# HAC-54 — local booking read projection mismatch

During real H3 booking retry, the old local projection omitted `offerId`. Strict Client correlation correctly refused to announce success, even though native persistence had succeeded. The ledger contained migrations only through `20261010225539`; main already contains the missing read projection `20261015122904`.

Resolution: replayed only that unchanged committed migration against the named local Docker DB, with prerequisite checks and atomic ledger entry; retained the same native intent/key and re-read/retried the existing booking. No extra booking was created, no guard disabled and no hosted migration performed. Native receipt snapshots also retain old projections/status, so the Client now re-reads the exact authorized record on idempotent replay.

The local ledger intentionally still has unrelated pending earlier Depot and later Border/Driver versions. Do not infer a fully current chain from the highest version. See `../HAC54_H3_BOOKING_INCREMENT.md` for exact records, checks and the remaining validation boundaries. Reproduction/repair runner: `cargomesh/scripts/hac54-local-booking-projection.mjs`.
