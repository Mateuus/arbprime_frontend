import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.mexc.com',
        pathname: '/api/platform/file/download/**',
      },
    ],
  },
};

export default nextConfig;
