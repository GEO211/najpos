import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for hot reload when using http://192.168.1.2:3000 on your LAN
  allowedDevOrigins: ["192.168.1.2"],
};

export default nextConfig;
