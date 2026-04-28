import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Hide dev-only route indicator (Next “N”) — it defaults to bottom-left and sits on the sidebar avatar. */
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "next-themes"],
  },
};

export default nextConfig;
