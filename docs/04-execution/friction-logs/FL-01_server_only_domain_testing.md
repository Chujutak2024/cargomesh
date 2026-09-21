# Friction Log #01: Incompatibilidad de 'server-only' en Suites de Pruebas Unitarias

- **Fecha:** 2026-09-19
- **Ticket Relacionado:** HAC-6
- **Descubierto por:** Cristhian Chujutalli (BE-2 & Tech Lead)
- **Componente:** Backend / Hono V2 / Node Test Runner (`tsx --test`)

---

### 1. El Incidente / Fricción
Al implementar la transición `DRAFT ➔ PENDING` de solicitudes de flete en `draft-submission-server.ts`, se intentó importar directamente la función en las pruebas unitarias (`draft-submission-server.test.ts`). Al ejecutar `pnpm test:release`, el runner nativo de Node.js falló de inmediato con el error:
```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './server-only' is not defined by "exports" in package.json
```

---

### 2. Causa Raíz
El paquete `server-only` de Next.js utiliza mecanismos de exportación condicional en `package.json` que solo el empaquetador de Next.js (Webpack / Turbopack) interpreta durante el build. Cuando se ejecutan pruebas unitarias rápidas con `tsx --test` o `node:test` fuera del ciclo de Next.js, Node no puede resolver el módulo y aborta la ejecución de toda la suite.

---

### 3. Solución / Workaround de Ingeniería
Se adoptó un patrón arquitectónico de separación en dos capas:
1. **`*-policy.ts` (Lógica Pura de Dominio):** Contiene las funciones de validación de negocio (`submitFreightRequestDraftWithDependencies`), roles de usuario, estados de flete y concurrencia optimista. **Cero imports de `server-only` ni llamadas de base de datos.** Recibe todas sus dependencias inyectadas.
2. **`*-server.ts` (Adaptador de Infraestructura):** Contiene el `import "server-only"`, instancia el cliente de Supabase Server y llama a la función de política pasándole el cliente real de base de datos.
3. Las pruebas unitarias prueban exhaustivamente la política pura en milisegundos sin requerir el runtime de Next.js ni mocks pesados de Node.

---

### 4. Lección Aprendida y Valor para el Ecosistema
En arquitecturas modernas con Next.js 15 y Hono V2, **la lógica de negocio nunca debe mezclarse con directivas exclusivas del bundler de React**. Aislar políticas puras permite pruebas unitarias determinísticas de alta velocidad que no rompen los pipelines de CI/CD.
