# Corrección de reproducción del frontend — 11 oct. 2026

## Hallazgo

El equipo comparaba `http://127.0.0.1:3907/carrier-portal` en `main` @ `21992a2` con el panel local `http://127.0.0.1:8080/v2-workspace#/dashboard` en `9d0c3ee`. El diseño ya estaba publicado mediante `a8a8044`; son dos superficies distintas. Además, la recuperación de solicitudes y su edición estaban restringidas por código al origen exacto 8080, y una copia nueva no disponía de la primera solicitud guardada en el navegador del autor. Abrir el coordinador en otro puerto tampoco reproducía los siete registros de las capturas.

## Corrección

- `/v2-workspace` lee y guarda su propio estado en cualquier origen HTTP/HTTPS. Conserva las claves y los registros existentes, fotos y progreso incluidos.
- Un navegador sin registros inicia siete cargas de presentación: Callao → Piura y las seis solicitudes existentes. No copia localStorage privado del autor ni crea FreightRequestV2, carriers, reservas o telemetría real.
- Los registros malformados permanecen guardados para recuperación; no se sustituyen por los valores iniciales.
- El puente entre 8080 y 8083 conserva sus controles de origen, ventana y nonce. No se inicia desde otros puertos ni desde sitios alojados.
- Se mantienen la portada 3D y el portal operativo del carrier, incluido el trabajo de identidad, permisos y mapa agregado por el equipo en `21992a2`.
- README y LOCAL_FRONTEND explican la pantalla correcta y el reinicio necesario para una compilación de producción.

## Validación ejecutada

- `node --conditions=react-server --import tsx --test --test-concurrency=4` sobre los 83 archivos `*.test.ts` descubiertos en `src/`: **456 pruebas aprobadas, cero fallos y cero omitidas**. Incluye logística, autenticación, permisos HAC-45 y contratos V2.
- Regresión focalizada tras ajustar la validación del guardado: **17 pruebas aprobadas**. Incluye inicialización en 8080, 3907, localhost:3090 y HTTPS, conservación de ediciones/fotos/original, rechazo de datos dañados y validación de procedencia. Los controles del puente de transferencia no se amplían.
- `node node_modules/typescript/bin/tsc --noEmit`: aprobado.
- `node scripts/check-architecture.mjs`: aprobado, 269 módulos y 61 entradas de cliente comprobadas.
- `node node_modules/next/dist/bin/next build`: aprobado; panel, portada y portal carrier compilados.
- Smoke del build en `http://127.0.0.1:3907/v2-workspace#/dashboard`: siete solicitudes, SOL-0004 con 18,000 kg, 24 × 750 kg, 4/5 y total 74,600 kg. Gráficos y camión 3D comprobados visualmente. Selección conservada tras recarga.
- Edición desde la ficha en 3907: unidades 24 → 25; recarga conserva 25 y calcula 18,750 kg. Restauradas a 24 y validadas carga/fechas para conservar la presentación 4/5. Flota: doce camiones y sus conductores; revisión: ficha completa de SOL-0004.
- Evidencia visual local fuera de Git: `cargomesh-panel-compartido-3907-20261011.jpg`. No se incluyen datos privados del navegador ni claves de configuración.

## Alcance

La publicación solicitada por el usuario corrige la reproducción de su frontend. No certifica el DoD completo de HAC-43 ni la persistencia empresarial o el tracking GPS; no aplica migraciones ni cambia proyectos, alias o ajustes de Vercel. Google Maps sigue necesitando una clave y un referrer autorizado; el adaptador local de Routes mantiene su permiso explícito y sus controles de origen existentes. Los cambios guardados en el navegador de una persona no se sincronizan mediante Git.
