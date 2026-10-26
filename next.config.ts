import type { NextConfig } from "next";

// A static export: `npm run build` writes a self-contained site to out/ that any static host can serve.
// BASE_PATH serves it from a sub-path, e.g. BASE_PATH=/mermaid-editor for GitHub Pages project sites.
const nextConfig: NextConfig = {
  output: "export",
  env: { NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || "" },
  basePath: process.env.BASE_PATH || undefined,
  trailingSlash: true,
};

export default nextConfig;
