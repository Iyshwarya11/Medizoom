import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/medizoom',
  output: 'standalone',
  trailingSlash: false,
};

export default nextConfig;