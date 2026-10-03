# HAC-12: capacidad ROAD sintética local

Extensión **local-only** del escenario HAC-29 `v2-road-baseline`. Requiere su seed y las dos migraciones HAC-12. No es una migración ni catálogo real de carriers. Agrega dos compatibilidades PHARMA, un activo refrigerado con calendario `SIMULATED`, duración simulada de 900 minutos para la lane Lima–Arequipa, evidencia simulada de que ese activo está listo en el área de recojo y un pool sin calendario. Así se prueban los estados `eligible` y `unknown` sin inventar una oferta o una ruta.

Aplicar `seed.sql` con `psql -v local_only=1`, ejecutar `verify.sql` y después el smoke HTTP `cargomesh/scripts/hac12-http-smoke.mjs`. Este último exige URLs loopback y credenciales QA locales por variables de entorno; borra exactamente los borradores que crea. Para retirar la extensión, ejecutar `cleanup.sql` también con `local_only=1` **antes** del cleanup del escenario HAC-29. No usar estos archivos en el Supabase alojado.
