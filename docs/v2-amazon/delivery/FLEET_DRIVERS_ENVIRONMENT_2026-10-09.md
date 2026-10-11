# Flota, conductores y entorno 3D — 9 de octubre de 2026

## Alcance entregado
Implementación en el frontend local activo de CargoMesh V2, para el coordinador. La aplicación se compiló y reinició en http://127.0.0.1:8080/v2-workspace. El alias local 8083 sirve la misma compilación.

### Entorno y controles
- Carretera con vegetación variada, pinos, arbustos, flores, rocas, señalización, postes, guardarraíl, farolas y centro logístico con muelles y contenedores.
- Paleta diferenciada para día, tarde y noche; nubes, sol, luna, estrellas y ventanas iluminadas por la noche.
- El sol usa una dirección del mundo independiente de la cámara. Girar el visor no arrastra el sol.
- Botón de 44 × 44 px dentro de la esquina superior derecha del visor, con icono y sin texto visible. Ciclo día → tarde → noche → día, con nombre accesible que indica el ambiente actual y siguiente.
- El ambiente inicial sigue la hora del equipo. El botón permite una previsualización temporal; al recargar vuelve al reloj del equipo.
- Movimiento de carretera, escenario y ruedas; pausa, giro de 360°, teclado, centrado y descarga PNG conservados. Pausa cuando la vista está fuera de pantalla y respeto de movimiento reducido.
- Eliminados los textos visibles de instrucciones de arrastre y el pie genérico «Visual de CargoMesh · vehículo ilustrativo, sin asignación».

### Catálogo y flota
- 12 vehículos y 10 carrocerías: rígido, tracto con remolque, refrigerado, plataforma, volquete, cisterna, mezclador, lona lateral, cama baja y maderero.
- Geometría y colores distintos, chasis conectado y fotografías reales de referencia para las tarjetas de flota.
- Las miniaturas PNG se exportaron del renderizador de los diez modelos. Se actualizó también el GLB estático predeterminado.
- Catálogo y esquema de solicitudes admiten las diez carrocerías sin descartar la selección al guardar o recargar.

### Conductores
- 12 perfiles locales vinculados a unidades, con fotografía, nombre, licencia y experiencia en la tarjeta compacta.
- Ficha independiente con licencia y vencimiento, ingreso, turno, base, especialidades, viajes, puntualidad, vehículo, recorrido, zonas y gráfico interactivo de actividad de la unidad.
- Navegación tarjeta → conductor → camión → conductor, con regreso a la vista de origen.
- La relación de conductor asignado sigue el pipeline guardado. Una unidad sin asignación puede mostrar su conductor habitual, claramente identificado; esto no inicia un viaje.
- Retratos CC0 de referencia con créditos desplegables. Los nombres y datos profesionales locales no identifican a las personas fotografiadas.

## Continuidad de datos
Se conservaron las claves de persistencia de solicitudes, selección, preferencias y pipeline. El estado de flota de seis unidades se amplía de forma aditiva a doce, conservando cada etapa, conductor y fecha anteriores. Si un conductor nuevo ya estaba ocupado en una asignación guardada, su nueva unidad se añade sin asignarlo de nuevo. La migración es idempotente.

Los registros obtenidos del servicio mantienen los campos desconocidos sin inventar perfiles ni telemetría. Los datos locales autorizados para la demo siguen separados del servicio. No se alteraron Supabase, Vercel, ramas remotas ni cuentas externas.

En el navegador del usuario se comprobó la continuidad de siete solicitudes, CM-LOCAL-01, 10 × 800 kg y las fechas existentes. Al verificar, el usuario había seleccionado Cisterna; esa selección se mantuvo. En el navegador de verificación se mantuvo CM-DEMO-06 y Volquete.

## Verificación
- 48 pruebas aprobadas: migración de flota, asignación, búsqueda, persistencia de las diez carrocerías, geometría finita y presupuesto, unión del chasis, recursos GLB, ambientes y movimiento de carretera.
- Compilación Next.js de producción aprobada, incluida validación de TypeScript. /v2-workspace: 51.6 kB, 284 kB de JavaScript inicial.
- Comprobación de arquitectura aprobada: 359 módulos, 60 entradas cliente.
- Navegador: ciclo de ambientes, conservación de cámara, sol fijo al girar, selección preservada, catálogo completo, imágenes cargadas, fichas y gráfico seleccionable.
- Escritorio 1440 × 900 y móvil 390 × 844. Sin desbordamiento horizontal del documento. El gráfico móvil permite desplazamiento interno y mantiene botones de al menos 44 px; barras con ancho comprobado mayor que cero.
- Consola sin errores durante la verificación. Avisos previos de deprecación de THREE.Clock usado por React Three Fiber y Google Maps Marker; no impiden esta entrega.

## Evidencia local
Directorio: D:\Documents\hackaton 2\cargomesh-v2-scene-expansion-20261009

- build.log, tests.log, browser-checks.json.
- scene-user-dashboard.png: pantalla principal del navegador del usuario y cisterna seleccionada.
- dashboard-day.png, dashboard-afternoon.png, dashboard-night.png: ambientes y botón.
- fleet-cards-desktop.png: tarjetas compactas y acceso al conductor.
- driver-profile-desktop.png, driver-chart-mobile.png: ficha y barras del gráfico corregidas.
- truck-catalog.png, scene-mobile.png, fleet-mobile.png.

## Archivos principales
- cargomesh/src/features/logistics-3d/{logistics-truck,road-environment,road-landscape,truck-model,truck-environment}.
- cargomesh/src/features/carrier-portal/{fleet-workspace,fleet-model,fleet-demo,fleet-drivers,driver-profile,local-truck-preference,local-draft-model}.
- cargomesh/public/v2-workspace/{drivers,fleet-photos,trucks} y GLB predeterminado.
- Créditos en drivers/CREDITS.md, fleet-portrait-photos.ts y fleet-photos.ts.

## Límites prácticos
Los modelos 3D son originales y generados mediante geometría; las fotos de flota son referencias. No se ha activado un proveedor externo de reconstrucción 3D desde fotos ni GPS en vivo. El visor renderiza en el navegador y esta entrega no añade servicios de pago.
