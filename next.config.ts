import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @kobo/web (web-standards/kobo-web) is a workspace package that ships TypeScript source.
  transpilePackages: ["@kobo/web"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // CI's build job sets this: the "web checks" job runs tsc in parallel, so the build need not repeat it.
    // Vercel builds leave it unset and still check types.
    ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1",
  },
  experimental: {
    // The browser keeps pages it loaded for this long, so going back to one shows it without a server round trip.
    // A server action that saves (revalidatePath) clears this cache, so an edit shows at once.
    staleTimes: { dynamic: 30, static: 60 },
  },
  // Events moved from /goals into Settings (2026-10-20); old links and bookmarks land there.
  async redirects() {
    return [{ source: "/goals", destination: "/settings#events", permanent: true }];
  },
};

export default nextConfig;
