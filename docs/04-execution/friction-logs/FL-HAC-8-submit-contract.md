# FL-HAC-8 — Compatibilidad del contrato de envío

## Contexto

Durante HAC-8 se verificó una diferencia de nombres entre el contrato funcional de
FE-1 y la implementación de la rama de BE-2: el formulario debe enviar
`expected_draft_version`, mientras que el endpoint en desarrollo consume
`draftVersion`.

## Impacto

Sin una capa de compatibilidad, el stepper podía cumplir el contrato documentado
pero fallar al integrarse en Gate-1, o funcionar contra la rama de BE-2 omitiendo
el campo canónico requerido por HAC-8.

## Resolución

`SubmitFreightRequestSchema` acepta ambos nombres, normaliza la versión y expone
las dos propiedades al servicio. El cliente FE envía
`expected_draft_version` como campo canónico y conserva `draftVersion` como alias
temporal de integración. La concurrencia optimista sigue siendo obligatoria y un
`409 STALE_DRAFT` se muestra al usuario con una alerta descriptiva bilingüe.

## Verificación

- Pruebas de intake: 70/70.
- Pruebas Hono de rutas/adaptador: 42/42.
- TypeScript: sin errores.
- Build de Next.js: correcto.

## Seguimiento Gate-1

Tech Lead debe elegir un único nombre público al integrar HAC-6 y HAC-8. Se
recomienda conservar `expected_draft_version` en REST y mapearlo internamente a
`draftVersion` únicamente donde lo requiera el servicio existente.
