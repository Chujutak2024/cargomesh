# Jerarquía de superficies y pantalla Solicitudes — 8 oct 2026

## Cambio visual compartido
Fondo azul gris suave (#e9f0f7 → #e2ebf5 → #e8eff6), superficies blancas y divisiones #c3d3e2. Bordes, sombras y textos secundarios definen una separación mayor sin modificar la distribución por pasos. La cabecera blanca se distingue del área de trabajo. Flota hereda los mismos bordes/sombras en listado, ficha y paneles operativos, conservando sus acentos de estado.

## Solicitudes locales
- Resumen compacto: solicitud guardada en este dispositivo, peso/unidades capturadas y fecha de recogida del borrador.
- Tarjeta con origen, destino, carga y visual del camión realmente preferido. El modelo 3D/foto propia conservan su significado ilustrativo/local.
- Avance de revisión con cinco enlaces y próxima acción. Los pasos comprobados provienen de completedStep; el estado proviene de savedForReview.
- Abrir ficha lleva a la revisión final; Ver ruta mantiene la vista de Google Maps y su fuente real. La tarjeta no repite todas las fechas, especificaciones y formularios.

## Datos y alcance
Se utiliza el mismo LocalDraftEnvelope persistido. No se crean solicitudes ni flota artificial para llenar espacio. No hay cambios de contratos, almacenamiento, API ni permisos. Copia local, sin publicación.

## Continuidad del visual 3D
El smoke detectó una escena que podía desaparecer al salir del viewport: el componente desmontaba el Canvas conservando ready=true, por lo que también ocultaba el poster. La escena inicializada ahora permanece montada con el ciclo de render pausado fuera de vista. Mientras está pausada se muestra su poster de referencia. Se conservan los controles, el giro y el fallback; no hay giro automático por defecto.

## Verificación
Tipos y arquitectura correctos (336 módulos / 52 entradas cliente). Build de producción completado. Smoke de navegación: Continuar revisión mediante Enter → Ruta y camión; Abrir ficha → Revisión final; Ver ruta → Google Maps Platform / Google Routes con datos estimados. Navegar no comprueba pasos ni modifica los campos.

Escritorio 1600 px y móvil 390 × 844 sin desbordamiento horizontal. Acciones nuevas de 44 px como mínimo y enlaces de pasos de 56 px en móvil. Las superficies blancas, bordes y sombras se comprobaron en Solicitudes, Panel, wizard y Flota. Los detalles completos permanecen en su ficha; la nueva pantalla muestra solo contexto y progreso.

Se preservaron Callao → Piura, Maquinaria industrial, 10 × 800 kg, las fechas y 1/5 pasos. El navegador del usuario mantiene Refrigerado; el navegador de pruebas mantiene Mi camión sin modelo/foto. No se igualaron sus preferencias ni almacenes.

Contraste calculado de texto: principal/blanco 13,09:1; secundario/blanco 6,06:1; secundario/fondo 5,03:1; botón primario/blanco 5,21:1. Es una comprobación de esta paleta, no una auditoría completa de accesibilidad.

Evidencia externa: D:\Documents\hackaton 2\cargomesh-v2-surfaces-requests-20261008 (requests-desktop.png, requests-mobile.png, requests-mobile-truck.png, browser-smoke.json, palette-contrast.json, build.log).
