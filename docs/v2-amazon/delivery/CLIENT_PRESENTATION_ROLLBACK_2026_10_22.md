# Client presentation rollback — 2026-10-22

The owner explicitly selected the Client appearance before Juan's PR154 and clarified that this is frontend only. This authorizes the rollback publication to main/Vercel; it is not a whole-site deployment rollback.

## Restored presentation

Restore the pre-154 Client shell colors/sidebar, dashboard composition, request/comparison/settings/tracking styles, conversation entry markup and Client/demo-shipper secondary pages. Remove the presentation files introduced by that redesign where their original consumers are restored.

The rollback script first compares every restored file with its PR154 version. It refuses to overwrite a later change. The Client layout only restores the preview notice styling; its newer session/access guard is preserved.

## Preserved

- All Carrier files, directory/modal changes, map framing, display aliases and commercial snapshot refresh from PR156.
- Native Client/Carrier backend contracts, auth/session implementation, request/offer/booking data and Nova integrations.
- Client display-label fixes from PR156 and the existing underlying intake/workflow components.
- Luis's later landing and workspace entry loaders, including Carrier's loader.
- Existing GitHub/Vercel automation. No local tests, build, typecheck or visual review are run, per the owner's instruction.

No database migration, fixture activation, commercial mutation, AWS deployment or full Vercel rollback is included. The owner will review the restored frontend.
