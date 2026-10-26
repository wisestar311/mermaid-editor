import type { NextConfig } from "next";

// A static export: `npm run build` writes a self-contained site to out/ that any static host can serve.
// BASE_PATH serves it from a sub-path, e.g. BASE_PATH=/mermaid-editor for GitHub Pages project sites.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.BASE_PATH || undefined,
  trailingSlash: true,
};

export default nextConfig;
