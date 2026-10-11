# Incidencias, carriers, registro y Ruta — 9 de octubre de 2026

## Entrega local

Implementado en `cargomesh-v2-current-local/cargomesh`, la aplicación activa del coordinador en http://127.0.0.1:8080/v2-workspace. Compilación de producción y reinicio de los procesos correspondientes a este proyecto en 8080/8083.

### Ruta e incidencias

- Resumen operativo con solicitud, origen/destino, carga y fechas; mapa y geometría existentes de Google conservados.
- Dos paneles compactos: cobertura del carrier y camión/planificación. Los formularios y detalles extensos tienen vistas propias en Flota.
- Aviso de incidencia con tipo, prioridad, descripción, ubicación y fecha. Visible también en el panel y la ficha de la solicitud seleccionada.
- Resolver una incidencia, programar reemplazo o cancelar con motivo. La cancelación requiere revisar un resumen y confirmar; conserva la solicitud y su historial, libera la reserva de la unidad y bloquea su edición/revisión.
- Reemplazos limitados a unidades disponibles, con capacidad suficiente y cobertura explícita, sin reserva activa en otra solicitud. Se conserva la cadena de frío y se comprueban vencimientos conocidos de seguro/revisión técnica.
- Programar reemplazo cambia la unidad de la solicitud y la carrocería del visor correspondiente, conservando la preferencia original, foto y modelo GLB. No inicia un viaje ni envía comunicaciones externas.

### Carriers, sedes y cobertura

Pantalla `Flota → Sedes y cobertura` con cuatro carriers y diez sedes iniciales:

| Carrier | Sedes | Alcance principal |
| --- | --- | --- |
| Tomate Transportes | Callao, Trujillo, Piura | Trayectos registrados de la costa norte |
| Sur Andino | Lima, Arequipa, Cusco | Corredor sur y cadena de frío |
| Continental Cargo | Santiago, Buenos Aires | Trayectos entre ambas ciudades |
| Iberia Logística | Madrid, Barcelona | Trayectos entre ambas ciudades |

Cada sede tiene dirección, tipo, horario y ciudades atendidas. Los trayectos son pares dirigidos: habilitar Callao → Piura no habilita Piura → Callao. Crear una sede no amplía automáticamente la cobertura a todo un país. `Nueva sede` permite registrar alcance local y, opcionalmente, un trayecto explícito.

### Nuevo camión

Pantalla propia `Flota → Nuevo camión`, con:

- Código, placa única, marca, modelo, año y una de diez carrocerías.
- Capacidad útil en kg, volumen en m³, descripción y equipamiento.
- Carrier y sede perteneciente a ese carrier; fecha de registro, estado inicial y descripción.
- Odómetro, nivel de combustible, tanque y consumo para estimar autonomía.
- Vencimiento de seguro y revisión técnica.
- Foto JPG/PNG/WebP, optimizada y validada antes de guardarla.

El alta agrega la unidad al directorio y al pipeline de conductores, manteniendo las doce unidades previas. Su ficha muestra foto, año, capacidad, documentos y sede; conserva las fechas y descripción del registro. Sin telemetría, no se inventan velocidad, utilización, costo ni lecturas de motor.

### Acabado visual y gráficos

- Tailwind CSS 3 existente en el proyecto, configuración con prefijo `cm-` y sin preflight para integrarse con los componentes actuales; sin nuevas dependencias.
- Fondo azul gris, superficies blancas, teal para acciones, violeta para comparación y rojo para incidencias/cancelación.
- Gráficos de carga con gradientes, entrada animada, comparación entre las siete solicitudes y lectura mediante clic, cursor o teclado.
- Gráficos de motor/conductores con cuadrícula, barras animadas y resaltado de selección. Se respeta movimiento reducido.
- Sedes, Ruta y alta responden a móvil; los datos extensos permanecen en sus pantallas para evitar saturar Ruta.

## Persistencia y continuidad

Las operaciones usan `cargomesh-coordinator-operations-v1`, separada de las claves existentes de solicitudes, selección, preferencias y pipeline. Estado validado con Zod, comprobación de revisión al guardar y sincronización entre vistas. Si no puede leerse el estado persistido, no se sobrescribe la copia original. Los errores de almacenamiento se muestran sin descartar datos anteriores.

La cancelación es un cambio de estado; no borra registros. El pipeline se amplía de forma aditiva, conservando asignaciones, etapas y fechas anteriores. Las nuevas unidades conservan sus fechas de alta y cambio de estado; se asignan conductores mediante el tablero existente.

En Opera se verificaron siete solicitudes, SOL-0001 seleccionada, Callao → Piura, 10 × 800 kg, las fechas existentes y Mezclador. La selección había cambiado por el usuario y se mantuvo al recargar.

## Verificación

- 47 pruebas relevantes aprobadas: operaciones, flota, migración de pipeline, solicitudes, preferencias y gráficos. Después del ajuste de fechas se repitieron las 18 pruebas de operaciones/pipeline, todas aprobadas.
- TypeScript y compilación Next.js de producción aprobados.
- Arquitectura aprobada: 365 módulos y 65 entradas cliente.
- Pruebas de navegador con los componentes reales y almacenamiento aislado en 8088: incidencia persistente → reemplazo CM-204 → cancelación con motivo y tres eventos conservados; nueva sede de Tomate y trayecto; alta CM-401 con foto y documentos; directorio de 13 unidades; asignación de Ana Valverde conservada al recargar.
- Aplicación activa en 8080: Ruta, enlace a sedes, alta independiente, gráficos interactivos con barras de dimensiones positivas y siete solicitudes conservadas.
- Escritorio 1440 × 1000 y móvil 390 × 844; sin desbordamiento horizontal del documento en Ruta, sedes o registro.

Las pruebas que cancelan o registran unidades usan un origen aislado. No cancelaron ni sustituyeron las solicitudes del usuario.

## Evidencia

`D:\Documents\hackaton 2\cargomesh-v2-operations-20261009`

- `tests.log`, `tests-final.log`, `build-final.log`, `browser-checks.json`.
- `route-desktop-final.png`, `route-mobile.png`, `carrier-sites-desktop.png`, `carrier-sites-mobile.png`.
- `dashboard-charts.png`, `registration-mobile.png`.
- `incident-history.png`, `registration-filled.png`, `registered-truck-detail.png`: flujos con datos de verificación aislados.

## Alcance de esta etapa

Los avisos son internos a la aplicación y las nuevas operaciones se guardan en el navegador. La integración de estas operaciones con Supabase/API, GPS y comunicaciones externas queda para una etapa posterior. No se modificaron servicios remotos, despliegues, ramas ni PR.
