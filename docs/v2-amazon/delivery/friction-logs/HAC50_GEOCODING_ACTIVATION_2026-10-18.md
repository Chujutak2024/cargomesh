# HAC-50 — Geocoding activation pending, 18-oct-2026

The active frontend project has no GOOGLE_GEOCODING_API_KEY. Its sole authorized test depot has no coordinates. Native checks confirm 503 GEOCODING_NOT_CONFIGURED and 422 LOCATION_COORDINATES_REQUIRED; no business writes or Google Routes calls were used to force a positive. The user confirmed the missing access and requested a prompt for Juan. See PROMPT_JUAN_GEOCODING.md. Code, contract tests and real-browser form verification are complete for this local increment; live point-route geometry validation and binding to Customer requests remain pending.

Actualización posterior, 18-oct: acceso técnico resuelto y flujo local por direcciones validado con Google. Ver ../HAC50_GEOCODING_LIVE_VALIDATION_2026-10-18.md. La selección de candidatos para pines ambiguos sigue pendiente; no se modificaron permisos ni datos para el positivo.
