import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { InstallAppBanner } from "@/components/pwa/install-app-banner";
import nextConfig from "@/next.config";

function readPngSize(buffer: Buffer) {
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG");

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("PWA Cyclo Stratège", () => {
  it("publie un manifeste installable et strictement online-first", () => {
    const definition = manifest();

    expect(definition).toMatchObject({
      id: "/",
      short_name: "Cyclo Stratège",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#071A17",
      theme_color: "#071A17",
      lang: "fr",
    });
    expect(definition.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });

  it.each([
    ["public/pwa/icon-192.png", 192],
    ["public/pwa/icon-512.png", 512],
    ["public/pwa/icon-maskable-512.png", 512],
    ["app/apple-icon.png", 180],
  ])("fournit %s à la bonne dimension", async (relativePath, size) => {
    const buffer = await readFile(path.join(process.cwd(), relativePath));

    expect(readPngSize(buffer)).toEqual({ width: size, height: size });
  });

  it("rend l’installation très visible dès le haut de l’accueil", () => {
    const markup = renderToStaticMarkup(<InstallAppBanner />);

    expect(markup).toContain("data-pwa-install-banner");
    expect(markup).toContain("iPhone · Android");
    expect(markup).toContain("Cyclo Stratège vous suit désormais dans la poche");
    expect(markup).toContain("Voir comment l’installer");
  });

  it("applique des protections HTTP sans cache applicatif", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");

    const rules = await nextConfig.headers!();
    const globalRule = rules.find((rule) => rule.source === "/:path*");
    const headers = new Map(
      globalRule?.headers.map(({ key, value }) => [key, value]),
    );

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.has("Cache-Control")).toBe(false);
  });
});
