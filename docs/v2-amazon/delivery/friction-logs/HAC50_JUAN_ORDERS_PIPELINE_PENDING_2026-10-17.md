# Friction log — Orders/Pipeline

Date: 2026-10-17 America/Lima.

| Observed blocker | Impact | Handling and remaining work |
| --- | --- | --- |
| All four current booking responses omit selected `offerId` | Exact offer/price/service/assignment/capacity relationships cannot be established | Keep records visible, mark relationships pending, disable proof-dependent commands. Existing additive projection migration identified in `BACKEND_GAPS.md`; no remote migration performed. |
| Carrier route and SQL allowlists do not expose execution/hold creates | Orders cannot create these records with Carrier credentials | Disabled controls explain the gap. Separate scoped extension documented; no Customer endpoint or service-role workaround. |
| Browser returns `Local browser use is disabled in Work settings` | No actual visual, click, focus, responsive, hydration or Back/Forward validation | Real HTTP reads plus controlled SSR and model/client tests; clearly limited evidence. Browser verification remains pending. |

No credentials, tokens or personal data are included in evidence. Temporary native-check sessions used the already configured local identity and were revoked locally after reading. No commercial records were mutated.
