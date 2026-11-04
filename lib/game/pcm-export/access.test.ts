import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canAccessPcmExport, canAccessDelegatedPcmExport } from "@/lib/game/pcm-export/access";
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
    expect(pageSource).toContain("!canAccessDelegatedPcmExport(user.id) && !await getCurrentGameStaffRole(supabase)");
    expect(routeSource).toContain("!canAccessDelegatedPcmExport(user.id) && !await getCurrentGameStaffRole(supabase)");
    expect(routeSource.indexOf("canAccessDelegatedPcmExport(user.id)")).toBeLessThan(
      routeSource.indexOf("await generatePcmExport("),
    );
    expect(routeSource).toContain('requestedWith === "pcm-export-admin"');
    expect(routeSource).toContain("origin === new URL(request.url).origin");
  });

  it("delegates only to Gouille's verified account, never to names or the homonym", () => {
    expect(canAccessDelegatedPcmExport("ee244935-5722-4626-a28f-dc3cf63aa6f4")).toBe(true);
    for (const value of [null,undefined,"Gouille","gouilleTW","f4a4c24e-b534-4a5f-adbc-8f259189b86c","game_staff"])
      expect(canAccessDelegatedPcmExport(value)).toBe(false);
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
