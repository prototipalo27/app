import type { NextConfig } from "next";

// Force Madrid timezone for all server-side date formatting
process.env.TZ = "Europe/Madrid";

const nextConfig: NextConfig = {
  cacheComponents: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "pdfkit",
    "nodemailer",
    "mqtt",
    "web-push",
    "@anthropic-ai/sdk",
    "stripe",
  ],
  outputFileTracingIncludes: {
    "/api/admin/regen-nda": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/admin/regen-contract": ["./node_modules/pdfkit/js/data/**/*"],
    "/nda/**": ["./node_modules/pdfkit/js/data/**/*"],
    "/contract/**": ["./node_modules/pdfkit/js/data/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
    ],
  },
};

export default nextConfig;
// deploy trigger
