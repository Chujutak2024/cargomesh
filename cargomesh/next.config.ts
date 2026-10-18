import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A development preview must not overwrite assets used by a running next start.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: path.join(__dirname, ".."),
  poweredByHeader: false,
};

export default nextConfig;
