# Sprint 2 · HAC-28 — retiro WebMCP del runtime V2

**Estado:** [HAC-28](https://linear.app/hackatonteamcargomesh/issue/HAC-28/chore-retirar-webmcp-v1-del-runtime-y-catalogo-activo-tras-el-corte) creada en Linear para Sprint 2, `Pendiente`. Esta ficha no acredita ejecución ni autoriza marcar HAC-12, HAC-11 o HAC-13 como terminadas. La rama exacta está registrada en HAC-28 y HAC-16, pero no debe abrirse hasta aprobar el manifiesto completo.

## Bloque A — metadatos

- **Título:** `[CHORE] Retirar WebMCP V1 del runtime y catálogo activo tras el corte ROAD V2`.
- **Versión / proyecto:** V2 · `P-HAC-1`.
- **Sprint / hito:** Sprint 2, 26 sep–2 oct 2026 (Lima) · HITO 2 · issue emergente de backend.
- **Responsable único:** Jean Paul. HAC-13 sigue siendo su entrega de QA separada; Cristhian revisa esta implementación y decide aceptación en HAC-16. Axel revisa únicamente el contrato MCP afectado.
- **Prioridad / labels:** High · `backend`, `audit`, `Improvement`, aplicados en Linear.
- **Fecha objetivo:** 2 oct 2026, antes del cierre de Gate-2. Estimar con Jean Paul el esfuerzo y su capacidad disponible junto a HAC-13; si los bloqueos HAC-12/HAC-11 consumen la ventana, registrar fallo/bloqueo y replanificar, no cerrar parcialmente.
- **Rama declarada, pendiente de aprobación del manifiesto:** `feat/be3-v2-webmcp-retirement` → PR a `codex/v2-amazon-contracts`. No abrirla ni reutilizar la rama de HAC-13 antes de aprobar el manifiesto registrado en esta issue y HAC-16.

## Bloque B — contexto operativo

### Objetivo

Tras integrar la elegibilidad ROAD V2 de HAC-12 y el consumidor MCP V2 de HAC-11, retirar del **runtime y catálogo activos** el filtro WebMCP V1 y las funciones dependientes. Web y MCP deben consultar servicios, áreas y lanes V2 con capacidad por fecha, admitiendo `0..N` servicios y cero candidatos. La eliminación no rehace HAC-12 ni convierte el runner WebMCP en una capacidad V2.

### Alcance

**Incluye:** inventario de consumidores de `supports_webmcp` y `provider_url`; reemplazo o aislamiento de `get-candidate-provider-pages.ts`, `get-provider-page-config.ts`, SQL heredado, tipos generados, rutas y pruebas que aún se ejecutan desde V2; migración **nueva** para sustituir/retirar funciones antes de retirar `supports_webmcp`; escenario V2 independiente y prueba de reset limpio; limpieza auditada de filas sintéticas V1 en la base activa tras identificar IDs, referencias y respaldo. `provider_url` se retira solo si ningún adaptador V2 la necesita; de requerirse un endpoint, se define configuración V2 por servicio/integración antes del corte.

**Fuera de alcance:** implementar de nuevo HAC-12 o HAC-11, fabricar ofertas, conservar tres carriers fijos para pasar QA, borrar migraciones históricas, mezclar seeds con migraciones estructurales, tocar `main` o producción Vercel. No borrar organizaciones/carriers por nombre ni hacer `DELETE` amplio/cascada sin inventario de claves y relaciones.

### Orden de ejecución y dependencias

1. **Ahora, sin rama:** inventariar rutas, funciones SQL, filas sintéticas y tests; clasificar cada referencia como V1 histórica, V2 activa o desconocida y publicar riesgos a HAC-12/HAC-11/HAC-13.
2. **Bloqueo de implementación:** HAC-12 entrega discovery ROAD V2 y HAC-11 usa ese servicio desde MCP; sin ambas rutas comprobadas no se elimina el contrato antiguo. HAC-13 aporta escenario/matriz V2, pero Jean Paul mantiene sus dos entregables y pruebas separados.
3. Con la rama aprobada, reemplazar referencias V2 y versionar la migración de funciones/esquema. Primero retirar/redefinir dependencias SQL; luego quitar la columna. No editar migraciones aplicadas.
4. Ejecutar la limpieza **de datos** como operación versionada y auditada separada de las migraciones estructurales, conforme a `AGENTS.md`: listado de IDs, relaciones, respaldo, consulta de precondiciones, transacción y conteos antes/después. Preservar el archivo/fixture V1 histórico solo si queda explícitamente excluido del gate V2.
5. Entregar PR, pruebas y evidencia a Cristhian para validación independiente en HAC-16. Defectos funcionales o de datos de esta issue regresan a Jean Paul como dueño.

### Relación con V1

**Reemplazar** el camino de descubrimiento basado en `supports_webmcp` y páginas de proveedor como producto activo. **Archivar o aislar** su regresión histórica V1, sin usarla como criterio de aceptación V2. La prueba Lima→Valparaíso con tres carriers no justifica añadir esos proveedores al escenario ROAD V2.

### Definición de terminado

- [ ] Inventario reproducible de referencias TS/SQL/tipos/tests y catálogo, con decisión por referencia y prueba de que ninguna ruta V2 activa lee `supports_webmcp`.
- [ ] Web y MCP usan el servicio compartido de HAC-12/HAC-11; escenario `v2-*` propio cubre elegible, sin cobertura, lane inversa, capacidad ocupada/desconocida y cero candidatos, sin ofertas inventadas.
- [ ] Nueva migración retira/redefine funciones dependientes y solo después elimina columnas sin consumidores; reset limpio, RLS/tenant y pruebas pertinentes ejecutadas. `provider_url` tiene decisión explícita, no retirada automática.
- [ ] Limpieza remota limitada a IDs sintéticos verificados, con respaldo y dependencias revisadas; conteos antes/después y transacción registrada. Ningún dato de otra organización se elimina por accidente.
- [ ] Suite V1 queda identificada como histórica/aislada o retirada del gate V2 con impacto documentado; `test:mcp:local` no se anuncia verde si sigue fallando.
- [ ] Matriz `contrato → caso esperado → comando → resultado → evidencia → defecto/reprueba`, PR, documentación de corte y riesgos enlazados. Cristhian valida este PR de forma independiente de HAC-13.

### Checklist de avance

- [ ] Inventario y dependencias acordados.
- [ ] Manifiesto/branch registrados y bloqueo funcional levantado.
- [ ] Implementación, migración y limpieza verificadas por el dueño.
- [ ] Hallazgos medios/altos corregidos por Jean Paul y reprobados.
- [ ] PR/evidencia entregados en `In Review`.

## Bloque C — gobernanza y cierre

El PR parte de la rama aprobada y apunta únicamente a `codex/v2-amazon-contracts`. El dueño culmina; Cristhian y el revisor MCP validan el DoD; el Tech Lead aprueba; el integrador autorizado mergea durante Gate-2. `Done` exige merge, pruebas, inventario de datos y evidencia del corte. Si la limpieza remota no es segura o no cabe en el Sprint 2, registrar bloqueo/friction log material y dejar la issue abierta; no declarar retirada completa.

## Mensaje listo para Jean Paul

> Jean Paul, te asignamos una issue emergente de Sprint 2 distinta de HAC-13: retirar WebMCP V1 del runtime y catálogo activos de CargoMesh V2. HAC-13 sigue siendo tu matriz/escenario QA; en esta issue tú eres responsable de implementación y corrección, y Cristhian hará la validación independiente en Gate-2.
>
> Puedes empezar ahora con el inventario sin abrir rama: busca todas las consultas TypeScript, funciones SQL, tipos, fixtures y tests que dependan de `supports_webmcp` o `provider_url`. Clasifica qué sigue en una ruta V2 ejecutable y qué es regresión V1 histórica. Revisa en particular `get-candidate-provider-pages.ts`, `get-provider-page-config.ts` y las funciones de result/booking bridge. Publica el inventario y cualquier dependencia no prevista en la issue.
>
> La implementación espera a que HAC-12 entregue el discovery ROAD compartido y HAC-11 lo consuma desde MCP. No rehagas esos servicios ni adaptes el escenario V2 para conservar los tres carriers V1. Una vez aprobada y registrada tu rama `feat/be3-v2-webmcp-retirement` en la issue y HAC-16, sustituye las referencias activas, prepara una migración nueva que retire primero las funciones dependientes y después `supports_webmcp`, y verifica un reset limpio con casos positivos, negativos y cero candidatos. Trata `provider_url` por separado: si alguna integración V2 necesita un endpoint, define dónde vive ese contrato antes de quitar la columna.
>
> Para los datos antiguos en Supabase, identifica IDs exactos y relaciones, conserva un respaldo y ejecuta una limpieza auditada y acotada fuera de las migraciones estructurales. No edites migraciones anteriores ni borres por nombre/cascada. Mantén la regresión V1 identificada fuera del gate V2; no afirmes que `test:mcp:local` pasa si no se ejecutó o falla.
>
> Entrega PR a `codex/v2-amazon-contracts`, comandos/resultados, inventario y conteos antes/después, impacto V1/V2 y riesgos. Si HAC-12/HAC-11 no llegan a tiempo o el borrado no es seguro, deja la issue bloqueada y avísanos antes del Gate-2: no la cierres a medias.
