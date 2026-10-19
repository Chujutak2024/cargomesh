# Fricciones — asociación de flota — 18-oct-2026

1. Docker estaba apagado. Se inició Docker Desktop en segundo plano y se recuperaron los contenedores existentes. La base del escenario ya contenía los datos; no se recreó ni se ejecutó un reset.
2. El escenario tenía Auth y acceso SQL probado, pero faltaba el transporte REST del front. Se agregó PostgREST al banco aislado y un gateway de desarrollo en loopback; se conservan los endpoints y JWT/RLS nativos.
3. El login del navegador recibió inicialmente errores por sesiones antiguas de otro Supabase loopback. Se separó el nombre de cookie únicamente para el perfil de desarrollo exacto, con tests; un reinicio del perfil permitió comprobar login y navegación reales. No se borraron cookies globales ni se desactivaron guards.
4. El proyector visual anterior podía interpretar BOX + TRACTOR_TRAILER como rígido. El nuevo adaptador de presentación distingue los datos del equipo y el modelo; los 80 mapeos coinciden con el manifiesto publicado, sin modificar la clasificación comercial persistida.
5. Los servicios del escenario compartían el mismo prefijo corto en la UI. Flota muestra hechos persistidos (temperatura cuando existe, peso y referencia final) para distinguirlos, sin inferir GENERAL de una temperatura ausente.
