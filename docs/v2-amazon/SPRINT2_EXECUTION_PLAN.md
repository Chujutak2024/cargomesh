# Sprint 2 V2 — plan de ejecución y aceptación para Linear

**Estado:** propuesta documental para afinar HAC-11…16 en sus IDs existentes; aún no sincronizada con Linear ni aprobada como nuevo DoD por los dueños. **Ventana registrada:** 26 septiembre–2 octubre 2026 (Lima). **Hito:** HITO 2. **Base de PR:** `codex/v2-amazon-contracts`, nunca `main`. Fechas vigentes a confirmar con cada dueño: HAC-11…15, 30 sep; HAC-16, 2 oct. Antes de abrir ramas, aprobar el manifiesto exacto ya propuesto en HAC-16 y registrar la rama en cada issue.

## Objetivo y corte verificable

Conectar el cimiento del Sprint 1 en un **primer flujo ROAD V2 comprobable**: una solicitud con origen, destino, carga y fecha consulta un servicio de elegibilidad/capacidad; Web y MCP reciben estados coherentes; el mapa muestra una ruta con fuente y estado; QA demuestra casos positivos, negativos y aislamiento. El resultado puede ser `0` candidatos. No se requiere inventar ofertas, ranking final, booking, capacidad multimodal ni acceso Alexa+ live para llamar a este corte HITO 2. Si Alexa+ no está accesible, demostrar servidor MCP con cliente externo y rotular ese límite.

La entrada al ciclo requiere conocer el estado real de HAC-22…26. Una dependencia en `In Review` permite preparar contratos y tests, pero no aceptar como integrada una capacidad que el gate anterior no aprobó. Un bloqueo externo se registra con dueño, impacto y alternativa honesta; no se convierte en un `pass`.

## Orden de trabajo y entregas tempranas

1. **Inicio (26 sep, si el manifiesto está aprobado):** Cristhian publica la forma de entrada/salida y estados del servicio ROAD (HAC-12). Axel acuerda scopes y respuesta MCP contra ese contrato (HAC-11). Luis y Juan fijan las propiedades de UI/mapa que consumirán, sin crear implementaciones paralelas de elegibilidad.
2. **Construcción en paralelo (26–30 sep):** cada dueño desarrolla y prueba su issue. Jean Paul prepara matriz y escenario de HAC-13 sin esperar al último PR; los casos de integración se ejecutan cuando aparezcan los contratos consumibles.
3. **Entrega (hasta 30 sep, sujeto a capacidad acordada):** PRs desde ramas declaradas, pruebas propias, límites y documentación. Hallazgos medios/altos regresan al dueño; QA reproduce y reprueba, no corrige su implementación.
4. **Gate (1–2 oct):** integrar únicamente PRs revisables en la rama declarada por HAC-16, comprobar el flujo Web/MCP/ROAD y hacer validación humana selectiva. El Tech Lead acepta cada issue por separado. No cambiar producción ni completar HITO 2 por porcentaje de Linear.

Registrar estimación ligera, confianza y horas disponibles con cada integrante antes de fijar compromiso. Si no cabe, reducir alcance explícitamente en la misma issue y ajustar la demostración; no esconderlo en un estado `Done`.

## Fichas para refinar las issues existentes

### HAC-12 — Cristhian · elegibilidad y disponibilidad ROAD

**Entrega:** servicio compartido y API para evaluar áreas, lane dirigido, requisitos de carga/equipo y capacidad por ventana. Entrada y salida tipadas; estado `eligible/ineligible/unknown` con motivos, fuente y fecha de evaluación. Publicar temprano contrato y ejemplo V2 a HAC-11/13/14/15.

**DoD propuesto:** (a) sedes sin área y lane inversa no conceden cobertura; (b) ausencia de calendario/capacidad no se transforma en disponibilidad confirmada; (c) peso/volumen y restricciones duras se verifican antes de recomendar; (d) `0..N` servicios sin lista fija de carriers; (e) pruebas unitarias/integración y negativas con escenario V2, aislamiento de organización cuando aplica; (f) ADR/contrato, comando, resultado y PR enlazados. **Fuera:** oferta contractual, ranking final, reservar equipo, RAIL/SEA/AIR live.

### HAC-11 — Axel · account linking y tool MCP V2

**Entrega:** persistencia `mcp_account_links` con RLS, restricciones, índices y pruebas; vinculación usuario+cliente+organización+scopes/revocación sin elegir automáticamente la primera membresía. El user-token falla cerrado antes de completar el vínculo. Tool MCP de consulta que usa **HAC-12**, no una segunda implementación de elegibilidad; distingue respuesta local MCP de invocación Alexa+ real.

**DoD propuesto:** (a) usuario válido, cliente incorrecto, link ausente/revocado, membresía ajena e intento entre tenants probados; (b) reset/migración/pgTAP y protocolo MCP con cliente externo documentados; (c) prueba V2 local independiente sobre el escenario de HAC-23 si está disponible, incluidos Piura sin cobertura y lane inversa; (d) regresión `local-integration.test.ts` V1 aislada/etiquetada, sin alterar catálogo V2 para fabricar tres candidatos; (e) catálogo/tool y documentación muestran estado real, no Alexa live sin llamada observada; (f) revisión de comentarios obsoletos que atribuyan account linking a HAC-21, si sobreviven en la rama. **Fuera:** Bedrock obligatorio, booking, reescribir el runner WebMCP V1 para convertirlo en producto V2.

### HAC-13 — Jean Paul · QA V2 y separación de regresiones

**Entrega:** escenario V2 reusable, matriz `contrato → caso → esperado → comando/pasos → real → evidencia → defecto/reprueba`, y reporte Gate-2. Mantener explícita la separación entre regresión V1 y prueba de integración V2, según el [ajuste ya propuesto](./SPRINT_ROADMAP.md#ajuste-de-dod-propuesto-para-hac-13--separación-v1v2).

**Rama candidata para el manifiesto:** `feat/be3-v2-qa-serviceability` (propuesta por Jean Paul). El Tech Lead debe aprobarla por nombre en HAC-13 y HAC-16 antes de crearla; se abre **después de Gate-1** desde la base V2 actualizada, con PR solo hacia `codex/v2-amazon-contracts`. Mientras tanto, el diseño de casos en un documento de Linear enlazado a HAC-13 no requiere rama. No reutilizar la rama de HAC-23 ni comenzar código HAC-13 sobre un escenario QA que aún no fue aceptado/integrado.

**DoD propuesto:** (a) ejecutar/reportar V1 y V2 por separado, con pass/fail/bloqueado y dataset identificable; (b) comprobar RLS/tenant, scopes/revocación MCP, Piura sin cobertura, lane inversa y `0` candidatos sin ofertas ficticias; (c) contrastar salida Web/MCP y mapa con el mismo caso cuando estén integrados; (d) registrar un recorrido humano no guiado de intake/preview/mapa o dejar bloqueo/prototipo explícito; (e) devolver hallazgos medios/altos a HAC-11/12/14/15 y ejecutar reprueba tras corrección. QA puede crear sus propios fixtures/tests/matriz en su rama, pero no implementa los arreglos funcionales de los otros dueños.

### HAC-14 — Luis · preview Web del resultado ROAD

**Entrega:** intake/preview que consume el servicio compartido HAC-12 y usa los componentes V2 de HAC-24; preserva distinción `eligible/ineligible/unknown`, fuente, fecha, estimación y ausencia de oferta.

**DoD propuesto:** (a) estados vacío/carga/error/sin candidatos y resultado parcial son legibles; (b) no muestra precio/ETA/booking confirmados sin fuente; (c) controles accesibles por teclado y verificables en móvil/escritorio; (d) prueba de contrato del adaptador y build/typecheck pertinentes; (e) una persona distinta del implementador intenta el flujo sin guía y se registra observación y reprueba. Si solo hay mock, se rotula prototipo y **no** se marca integración HAC-12 terminada. **Fuera:** implementar lógica de elegibilidad en frontend o desplegar producción.

### HAC-15 — Juan · mapa ROAD con procedencia

**Entrega:** mapa que consume el contrato de ruta/servicio, muestra origen/destino y estado de traza/distancia/ETA con proveedor/fecha cuando existan. Mantiene separado “ruta posible” de “carrier cubre y tiene cupo”.

**DoD propuesto:** (a) traza real, estimada, sintética o desconocida se distinguen; (b) proveedor, costo/cuota y seguridad de key siguen la ADR de HAC-25; (c) sin key/autorización, fallback sin falsa integración live; (d) smoke de teclado/responsividad, error de proveedor y `0` candidatos; (e) prueba humana de interpretación junto con HAC-13. **Fuera:** peajes, permiso aduanero o tránsito transfronterizo confirmados sin datos verificables.

### HAC-16 — Cristhian · Gate-2 de integración

**Entrega:** manifiesto de ramas aprobado, revisión por issue, integración autorizada y acta con matriz issue→PR→contrato→prueba→evidencia→decisión. La rama de integración solo se abre cuando haya PRs revisables.

**DoD propuesto:** (a) contratos de HAC-11/12/14/15 compatibles; (b) HAC-13 reporta V1 y V2 por separado con fallos abiertos visibles; (c) ejecutar scripts pertinentes descubiertos desde `cargomesh/package.json` y pruebas de BD según entorno, sin afirmar verde cuando una suite no se ejecutó; (d) una prueba humana del flujo Web, y Alexa+ solo si hubo acceso/invocación real; (e) incidentes medios/altos enviados a sus dueños y revalidados; (f) decisión por issue y alcance de demo documentados. El orden es dueño culmina → equipo valida → Tech Lead aprueba → integrador mergea a `codex/v2-amazon-contracts`. Un PR ya mergeado se audita, no se repite.

## Paquete mínimo de evidencia

- HAC-12: contrato de elegibilidad/capacidad, casos negativos y resultado.
- HAC-11: migración/RLS/account link, matriz de auth, cliente MCP y separación V1/V2.
- HAC-13: escenario con README/cleanup, matriz reproducible, defectos y repruebas.
- HAC-14: preview/capturas y observación humana; fuente de datos declarada.
- HAC-15: ADR/proveedor, mapa y procedencia; key ausente de logs/capturas.
- HAC-16: acta de gate, suites ejecutadas/no ejecutadas, riesgos aceptados o pendientes.

HAC-27 puede analizar hallazgos de HAC-23 y proponer prioridades; no sustituye la matriz ni crea una sexta core de implementación. El benchmark inicial de latencia/tokens es exploratorio solo si hay baseline/dataset; Bedrock y Alexa+ live no se exigen por documentación cuando faltan acceso/cuota.
