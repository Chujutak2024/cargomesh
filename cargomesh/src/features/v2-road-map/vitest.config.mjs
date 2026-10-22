import { fileURLToPath } from "node:url";

export default {
  resolve: { alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  test: { globals: true, environment: "node", include: ["src/features/v2-road-map/operation-map.test.mjs"] },
};
