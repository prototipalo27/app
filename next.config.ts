import type { NextConfig } from "next";

// Force Madrid timezone for all server-side date formatting
process.env.TZ = "Europe/Madrid";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["googleapis", "google-auth-library", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/admin/regen-nda": ["./node_modules/pdfkit/js/data/**/*"],
    "/nda/**": ["./node_modules/pdfkit/js/data/**/*"],
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
