import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // CI's build job sets this: the "web checks" job runs tsc in parallel, so the build need not repeat it.
    // Vercel builds leave it unset and still check types.
    ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1",
  },
};

export default nextConfig;
