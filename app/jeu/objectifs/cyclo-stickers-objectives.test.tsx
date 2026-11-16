import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/supabase/authenticated-user", () => ({
  getAuthenticatedUser: mocks.getUser,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  redirect: (url: string) => {
    throw new Error("redirect:" + url);
  },
}));
vi.mock("@/components/game/game-header", () => ({ GameHeader: () => null }));
vi.mock("@/components/game/trophy-gallery", () => ({ TrophyGallery: () => null }));
vi.mock("@/services/game-header-data", () => ({ getGameHeaderData: async () => ({ displayName: "DS" }) }));
vi.mock("@/services/daily-rewards", () => ({ getCurrentDailyRewardOverview: async () => null }));
vi.mock("@/services/trophy-gallery", () => ({ getSportingDirectorTrophyGallery: async () => null }));

import { claimCycloStickersObjectiveAction } from "./actions";
import ObjectivesPage from "./page";

const editionId = "cyclo-stickers-s4-v1";
const finalObjective = {
  edition_id: editionId,
  achievement_id: "count-50",
  title: "Mémoire du peloton",
  current_value: 72,
  target_value: 72,
  reward_cash: 250000,
  reward_experience: 1000,
  reward_reputation: 100,
  trophy: true,
  display_order: 7,
  claimed_at: null,
  is_completed: true,
};

function claim() {
  const form = new FormData();
  form.set("editionId", editionId);
  form.set("achievementId", "count-50");
  form.set("returnPath", "/jeu/objectifs?groupe=cyclo_stickers&statut=completed#objectives-list");
  return claimCycloStickersObjectiveAction(form);
}

function stubObjectives(rows: Array<Omit<typeof finalObjective, "claimed_at"> & { claimed_at: string | null }>) {
  mocks.rpc.mockImplementation((name: string) =>
    name === "get_current_cyclo_stickers_reward_objectives"
      ? { abortSignal: async () => ({ data: rows, error: null }) }
      : Promise.resolve({ data: [], error: null }),
  );
}

describe("Cyclo-Stickers objectives", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "ds" } }, error: null });
  });

  it("shows the ready objective, its gains and its trophy in the common catalogue", async () => {
    stubObjectives([finalObjective]);
    const html = renderToStaticMarkup(await ObjectivesPage({
      searchParams: Promise.resolve({ groupe: "cyclo_stickers", statut: "completed" }),
    }));
    expect(html).toContain("Une récompense vous attend");
    expect(html).toContain("Récompenses Cyclo-Stickers à récupérer");
    expect(html).toContain("Trophée · Mémoire du peloton");
    expect(html).toContain("1000 XP");
    expect(html).toMatch(/250\s000\s€/);
    expect(html).toContain("100 réputation");
    expect(html).toContain('name="achievementId" value="count-50"');
    expect(html).toContain("Récupérer la récompense");
  });

  it("clears the alert and keeps the trophy objective in the catalogue after claiming", async () => {
    stubObjectives([{ ...finalObjective, claimed_at: "2026-11-16T10:00:00Z" }]);
    const html = renderToStaticMarkup(await ObjectivesPage({
      searchParams: Promise.resolve({ groupe: "cyclo_stickers" }),
    }));
    expect(html).not.toContain("Récompenses Cyclo-Stickers à récupérer");
    expect(html).not.toContain("name=\"achievementId\"");
    expect(html).toContain("Récompense récupérée le");
    expect(html).toContain("Trophée · Mémoire du peloton");
  });

  it("uses the existing album claim and refreshes both screens", async () => {
    mocks.rpc.mockResolvedValue({ data: { alreadyClaimed: false }, error: null });
    await expect(claim()).rejects.toThrow(/redirect:\/jeu\/objectifs\?.+succes=.+#objectives-list/);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("claim_current_cyclo_stickers_achievement", {
      p_edition: editionId,
      p_achievement_id: "count-50",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/objectifs");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/album");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu");
  });
});
