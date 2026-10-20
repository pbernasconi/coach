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
  experimental: {
    // The browser keeps pages it loaded or prefetched for this long, so going back to one, or a click on a nav
    // link (prefetched in full, DashboardNav), shows it without a server round trip. A server action that saves
    // (revalidatePath) clears this cache, so an edit shows at once; other data is at most this old on a click.
    staleTimes: { dynamic: 30, static: 60 },
  },
};

export default nextConfig;
