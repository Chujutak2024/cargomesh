# Prompt para Juan — sedes y flota Three.js de CargoMesh

Juan, encárgate de la presentación Three.js de Sede, Ruta y camiones. Cristhian mantiene catálogo, seeds, cobertura, disponibilidad y backend; Jean desarrolla Cliente. Trabajaremos con contratos compatibles y responsabilidades separadas.

## Base y alcance

Actualiza tu checkout desde la rama publicada `origin/codex/unified-workspaces-demo-boundary`. Antes de modificar código, verifica AGENTS.md, la issue y la rama de entrega registrada para tu trabajo; no inventes una issue/rama ni hagas push a la rama de Cristhian, main o una rama compartida. Si trabajas desde otra base aprobada, identifica el delta necesario sin mezclar ramas por conveniencia. No cambies despliegues, claves, autenticación, Supabase ni dependencias sin necesidad/autorización aplicable.

Lee:
- docs/v2-amazon/delivery/HAC50_COVERAGE_SITES_CARGO_PLAN_2026-10-15.md
- docs/v2-amazon/delivery/HAC50_OPERATIONAL_ASSESSMENT_HANDOFF_2026-10-15.md
- docs/v2-amazon/delivery/HAC50_CLIENT_DEPOT_CREW_HANDOFF.md
- docs/v2-amazon/contracts/CARRIER_COVERAGE_AND_SERVICEABILITY.md
- docs/v2-amazon/contracts/TRANSPORT_PLANS_AND_FLEET.md

Usa la skill cargomesh-ux si está disponible. Descubre las versiones instaladas de Three.js/R3F; no instales o actualices paquetes para igualar una documentación externa.

## Cantidades y reutilización

El escenario propuesto es 10 carriers, 16 sedes, 80 vehículos y 80 conductores. Todavía no existe ese seed completo: no lo presentes como catálogo operativo instalado. El runtime debe aceptar 0..N, sin fijar esas cantidades como reglas.

No crear 16 edificios totalmente diferentes ni 80 modelos de camión. Objetivos visuales:

1. Cuatro o cinco plantillas de sede configurables: base compacta, centro de distribución, sede con conservación refrigerada, patio/taller y terminal de transferencia. Variar número de puestos, tamaño, colores, señalética y decoración. Las 16 identidades usan esas plantillas; la apariencia no acredita capacidad ni permisos.
2. Catálogo de 15–20 variantes de camión reutilizables. Ya existen diez familias procedurales: rigid, articulated, refrigerated, flatbed, tipper, tanker, mixer, curtainsider, lowloader y logging. Reutilízalas primero. Una variante de color no equivale a una capacidad/equipo nuevo. Prioriza caja cerrada, refrigerado, plataforma y maderero; no modeles aviones en este corte.
3. Reutilizar imágenes, posters, GLB y materiales existentes. Evitar assets externos sin procedencia/licencia verificable. Una foto/poster no se convierte en modelo 3D rotando una imagen.

## Rutas de trabajo

Principalmente bajo `cargomesh/`:
- src/features/logistics-3d/**
- public/v2-workspace/trucks/** y assets de sede en una carpeta específica de esa funcionalidad
- Nuevos componentes/fixtures visuales dentro de la funcionalidad 3D

Puntos existentes que debes inspeccionar:
- src/features/logistics-3d/truck-model.ts
- src/features/logistics-3d/truck-scene.tsx
- src/features/logistics-3d/truck-model-assets.ts
- src/features/logistics-3d/depot-model.ts
- src/features/logistics-3d/depot-arrival.tsx
- src/features/logistics-3d/depot-cycle.ts
- src/features/logistics-3d/route-navigation-3d.tsx
- src/features/logistics-3d/scenic-route-model.ts
- src/features/carrier-portal/truck-inspection.tsx

El último es un punto de integración: antes de editarlo, revisa sus consumidores y coordina el cambio mínimo. Mantén compatibilidad de los exports compartidos con landing y Fleet. No modificar coordinador, formularios comerciales, navegación general, shared/schemas/v2, server/**, migraciones o seeds para hacer funcionar una escena. Si necesitas un contrato nuevo, propón el DTO visual y su mapper para acordarlo con Cristhian.

## Qué debe hacer Sede

La unidad principal es la sede y sus recursos; seleccionar un camión cambia el foco, no reinicia toda la escena.

Representar simultáneamente:
- Presentes: estacionados, esperando, cargando, descargando o en mantenimiento.
- Llegadas previstas: camiones que todavía vienen hacia la sede.
- Salidas previstas o en curso.
- Ubicación desconocida, en la lista; no colocar esos vehículos dentro del patio.
- Visitantes de otro Carrier solo cuando los props autorizados/escenario indiquen una visita compartida. No leer toda la flota ajena.

Una base asignada no se usa como prueba de presencia. Estacionado no equivale a disponible. No iniciar un ciclo automático de carga a todos los camiones. La caja/mercancía debe corresponder al contexto visual: pallets/cajas, madera o carga refrigerada, sin inventar sus requisitos comerciales.

Caso mínimo de simulación:
A ocupa un muelle cargando; B llega y espera; C está estacionado sin tarea; D sale hacia su viaje. A libera el muelle y B puede entrar; C sigue estacionado. Un camión en mantenimiento permanece bloqueado. Los eventos de la simulación están fuera del canvas y tienen identidad estable. No hay doble ocupación ni reinicio al cambiar de pestaña. Este controlador es visual/simulado, no una segunda implementación de reservas reales.

## Continuidad con Ruta

Conservar assetId, siteId y trip/executionId cuando exista. Separar camino de entrada/salida del patio y recorrido geográfico. Las animaciones interpolan un estado recibido, no crean ofertas, bookings, citas, GPS o ubicaciones reales.

No dibujar carreteras inventadas para suplir Google Routes ni asumir que una curva 3D demuestra acceso vial. Si la geometría del proveedor no está disponible, mantener simulación escénica explícita. No trasladar ni almacenar geografía de Google en una escena independiente sin revisar el uso permitido. El cálculo de rutas y sus claves quedan en el backend de Cristhian.

## UX y rendimiento

- Toda interfaz nueva en inglés, con lista HTML accesible paralela al canvas.
- Cámara general de sede y enfoque del seleccionado; probar encuadre durante todo el movimiento y al redimensionar.
- Estados de carga, error, vacío, reintento y fallback cuando WebGL/asset falle.
- Controles claros de reproducción; pausar el visor no cancela operaciones. Movimiento reducido conserva acceso a la información.
- Cargar solo la sede visible. No montar 16 canvas ni renderizar todos los modelos de catálogo simultáneamente.
- Compartir geometrías/materiales, cachear cargas e instanciar cuando sea compatible con articulaciones/animación.
- Actualizar poses con refs/tiempo de render, sin setState por vehículo y frame. Pausar dibujo fuera de pantalla/pestaña según la política de la escena.
- Liberar recursos propios al desmontar sin destruir caches compartidas. Medir draw calls/memoria y condiciones del dispositivo; no prometer FPS a partir de una captura.

## Entrega por cortes

1. Inventario de modelos actuales, plantillas y DTO visual propuesto. Explicar qué se reutiliza y qué falta.
2. Catálogo de variantes y sedes configurables; conservar compatibilidad de escenas existentes.
3. Sede con varios vehículos y caso A/B/C/D determinístico, identificado como simulación.
4. Continuidad Sede→Ruta y mappers para props conectados cuando estén disponibles.

Verifica casos de sede vacía, varias llegadas, estacionado reservado, mantenimiento, visitante autorizado, evento duplicado, cambio de selección/pestaña y carga de asset fallida. Revisa móvil, escritorio, movimiento reducido y desmontajes repetidos.

Entrega archivos tocados, instrucciones de preview, capturas/video, mediciones y tests pertinentes descubiertos en el repo. No declarar datos/live, creación de 80 vehículos en Supabase o cierre de la issue por tener la escena dibujada.
