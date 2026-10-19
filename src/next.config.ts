import type { NextConfig } from "next";

const legacyDeployment = "https://bevo-tasker-pr5cq1qsg-bavlymosa37-4178.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/legacy.html" },
        {
          source: "/_next/static/:path*",
          destination: legacyDeployment + "/_next/static/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
