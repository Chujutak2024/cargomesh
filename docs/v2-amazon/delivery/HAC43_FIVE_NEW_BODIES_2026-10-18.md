# HAC-43 — cinco carrocerías nuevas, 18 de octubre de 2026

Incremento sobre `70b315c` en `codex/v2-full-carrier-operations`, publicado por petición del usuario en la misma rama. El PR #128 anterior ya fue integrado por el equipo. Este incremento no modifica esa entrega histórica ni integra la rama base; su destino de revisión autorizado sigue siendo `codex/unified-workspaces-demo-boundary`, nunca `main`.

## Resultado

El catálogo pasa de 18 variantes a 23 diseños: se añaden cinco carrocerías con geometría propia, reutilizando chasis y materiales existentes.

| Diseño | Diferencia estructural |
|---|---|
| Portavehículos | Dos niveles, cuatro autos, arriostramientos y rampas traseras |
| Ganadero | Dos pisos, laterales abiertos con listones, postes y rampa trasera |
| Grúa telescópica | Brazo de tres secciones, cabina de operador, contrapeso, gancho y estabilizadores recogidos |
| Recolector compactador | Cuerpo redondeado, tolva trasera, hidráulicos y elevador de contenedores |
| Silo granelero | Tres conos de descarga, tuberías, válvulas, pasarela superior y escalera |

La pantalla abre con los cinco nuevos y permite volver al catálogo completo. Se conservan las diez familias de equipo y sus modelos predeterminados; no se crean vehículos empresariales ni capacidades nuevas. Una pérdida de WebGL muestra un aviso, sin sustituir una carrocería nueva por la foto de su familia original. El coordinador rechaza diseños incompatibles con el escenario de pallets, conservando su estado.

## Verificación

- En el turno de implementación, sobre estos mismos archivos: 138/138 pruebas de logística, TypeScript, arquitectura (410 módulos / 112 entradas cliente) y build PASS.
- Antes de publicar: repetición focal de `visual-catalog.test.ts`, `truck-model.test.ts` y `depot-coordinator.test.ts`: 18/18 PASS.
- Cinco geometrías distintas entre sí y frente a las diez bases, comparando SHA256 de posiciones con colores idénticos y sin accesorios. Menos de 50 000 triángulos y hasta 12 lotes por camión.
- [Navegador: diez renders, escritorio y móvil](./evidence/HAC43-five-new-bodies-2026-10-18/browser-results.json), búsqueda, catálogo de 23, selección de modelo original y pérdida de contexto WebGL: PASS, sin errores no capturados ni solicitudes empresariales/externas.
- [Coordinador: siete comprobaciones entre vistas](./evidence/HAC43-five-new-bodies-2026-10-18/retained-state-results.json): reloj, selección y pausa retenidos en estudio y diálogo. Sin grabación nueva; el video anterior conserva su alcance histórico.
- [Comparación visual de los cinco modelos](./evidence/HAC43-five-new-bodies-2026-10-18/five-new-bodies.png).

Comando focal desde `cargomesh/`:

```powershell
node --conditions=react-server --import tsx --test src/features/logistics-3d/visual-catalog.test.ts src/features/logistics-3d/truck-model.test.ts src/features/logistics-3d/depot-coordinator.test.ts
```

## Preview y revisión

Desde un checkout de esta rama, Node >=22 y dependencias instaladas según lockfile:

```powershell
cd cargomesh
pnpm install --frozen-lockfile
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 8091
```

Abrir `http://127.0.0.1:8091/vehicle-designs`: seleccionar los cinco diseños iniciales, girar el camión y comprobar sus estructuras. En móvil deben caber completos. El filtro «All families» muestra los 23; «5 new body styles» vuelve a los cinco. Es una caminata experta y prueba automatizada, no una validación con usuarios externos ni un benchmark de rendimiento.

Los dos archivos de presentación del equipo (`fleet-workspace.tsx` y `truck-inspection.tsx`) solo reciben un import y el conteo dinámico del enlace al estudio. El integrador conserva su presentación restaurada al trasladarlos. No se cambian rutas, autenticación, contratos, configuración de despliegue o Supabase. El proceso anterior de 8080 no muestra este incremento hasta actualizar su checkout/build. No se ejecuta un despliegue manual.
