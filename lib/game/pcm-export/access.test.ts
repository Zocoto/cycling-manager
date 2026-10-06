import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canAccessPcmExport } from "@/lib/game/pcm-export/access";
import { PRIVATE_ADMIN_EMAIL } from "@/lib/game/private-admin-access";

const pageSource = readSource("app/jeu/export-pcm/page.tsx");
const routeSource = readSource("app/api/admin/pcm-export/route.ts");

describe("acces a l'export PCM", () => {
  it("autorise uniquement le compte prive de Roger Letesteur", () => {
    expect(canAccessPcmExport(PRIVATE_ADMIN_EMAIL)).toBe(true);
    expect(canAccessPcmExport("  PAUL.LEBLANC22@GMAIL.COM ")).toBe(true);
    expect(canAccessPcmExport("membre@example.com")).toBe(false);
    expect(canAccessPcmExport(null)).toBe(false);
  });

  it("protege la page et l'API cote serveur", () => {
    expect(pageSource).toContain("if (!canAccessPcmExport(user.email)) notFound()");
    expect(routeSource).toContain("if (!canAccessPcmExport(user.email))");
    expect(routeSource.indexOf("canAccessPcmExport(user.email)")).toBeLessThan(
      routeSource.indexOf("await generatePcmExport("),
    );
    expect(routeSource).toContain('requestedWith === "pcm-export-admin"');
    expect(routeSource).toContain("origin === new URL(request.url).origin");
  });

  it("ne met jamais le fichier exporte en cache", () => {
    expect(routeSource).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(routeSource).toContain('export const dynamic = "force-dynamic"');
  });
});

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}
