import type { NextConfig } from "next";

const christmasPreviewCsp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cdb-converter", "sql.js"],
  outputFileTracingIncludes: {
    "/apercus/noel/*": ["./assets/christmas-preview/*"],
    "/jeu/noel/experience/*": ["./assets/christmas-preview/*", "./assets/christmas-production/*"],
    "/api/christmas": ["./assets/christmas-preview/rules.js", "./assets/christmas-preview/flight-physics.js", "./assets/christmas-preview/tournee.js"],
    "/api/admin/gala-s4-export": [
      "./assets/pcm/OfficialRelease.template.cdb",
      "./assets/pcm/OfficialLocal.template.cdb",
      "./node_modules/sql.js/dist/sql-wasm.wasm",
    ],
    "/api/game/news/images": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-*/**/*",
    ],
    "/api/game/media-center/images": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-*/**/*",
    ],
    // Vercel handles Next's image optimizer separately and excludes libvips from
    // normal traces. This custom upload route needs its own native runtime.
    "/api/game/chat/images": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-*/**/*",
    ],
    "/api/cron/global-chat-quiz": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-*/**/*",
    ],
    "/api/admin/pcm-export": [
      "./assets/pcm/OfficialRelease.template.cdb",
      "./assets/pcm/OfficialLocal.template.cdb",
      "./node_modules/sql.js/dist/sql-wasm.wasm",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
        ],
      },
      {
        source: "/apercus/noel/:fichier",
        headers: [
          { key: "Content-Security-Policy", value: christmasPreviewCsp + "; frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/apercus/noel/tournee.html",
        headers: [
          { key: "Content-Security-Policy", value: christmasPreviewCsp + "; frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/jeu/noel/experience/:fichier",
        headers: [
          { key: "Content-Security-Policy", value: christmasPreviewCsp + "; connect-src 'self'; frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
