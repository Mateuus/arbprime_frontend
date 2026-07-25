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
  async headers() {
    return [
      {
        // O console admin nunca deve ser indexado (reforça o <meta robots> do
        // DashboardLayout e cobre respostas não-HTML).
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  async redirects() {
    return [
      // Índice canônico do painel. Temporário (307) enquanto a feature evolui —
      // trocar para permanent:true quando estabilizar.
      { source: '/admin', destination: '/admin/dashboard', permanent: false },
    ];
  },
};

export default nextConfig;
