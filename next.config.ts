import type { NextConfig } from "next";

// A static export: `npm run build` writes a self-contained site to out/ that any static host can serve.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
