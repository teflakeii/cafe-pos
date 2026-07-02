import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: trace from the repo root so the standalone bundle includes the
  // correct workspace dependencies (and to silence the multi-lockfile warning).
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: {
    root: path.join(__dirname, "../../"),
  },
};

export default nextConfig;
