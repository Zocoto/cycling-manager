import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHalloweenShortcut } from "./dashboard-halloween-shortcut";

const { maybeSingle } = vi.hoisted(() => ({ maybeSingle: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    return { from: vi.fn().mockReturnValue(query) };
  },
}));

describe("raccourci Halloween du bureau du DS", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
  });

  it("sépare le bandeau des raccourcis du haut sur tous les écrans", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "halloween-2026" }, error: null });

    const html = renderToStaticMarkup(await DashboardHalloweenShortcut());

    expect(html).toContain('href="/jeu/halloween"');
    expect(html).toContain('class="mt-5 flex flex-wrap');
    expect(html).toContain("Le peloton de minuit vous attend.");
    expect(html).toContain("Jeux &amp; boutique");
  });

  it("ne laisse aucun espace vide quand l’événement n’est pas actif", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    expect(renderToStaticMarkup(await DashboardHalloweenShortcut())).toBe("");
  });

  it("ne laisse aucun espace vide si le chargement échoue", async () => {
    maybeSingle.mockRejectedValue(new Error("unavailable"));

    expect(renderToStaticMarkup(await DashboardHalloweenShortcut())).toBe("");
  });
});
