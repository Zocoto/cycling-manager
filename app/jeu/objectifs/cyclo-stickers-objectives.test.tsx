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

import { ALBUM_ACHIEVEMENTS } from "@/lib/game/collector-album";
import type { GameObjectiveRow } from "@/lib/game/objectives";

import { claimCycloStickersObjectiveAction } from "./actions";
import ObjectivesPage from "./page";

const editionId = "cyclo-stickers-s4-v1";
const finalObjective = {
  edition_id: editionId,
  source_season: 4,
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

function claim(achievementId: string) {
  const form = new FormData();
  form.set("editionId", editionId);
  form.set("achievementId", achievementId);
  form.set("returnPath", "/jeu/objectifs?groupe=cyclo_stickers&statut=completed#objectives-list");
  return claimCycloStickersObjectiveAction(form);
}

const careerObjective: GameObjectiveRow = {
  objective_key: "recruit_first_rider",
  objective_type: "primary",
  objective_group: "transfers",
  title: "Recruter un premier coureur",
  description: "Recrutez un coureur dans votre équipe.",
  current_value: 1,
  target_value: 1,
  reward_cash: 1000,
  reward_experience: 100,
  reward_reputation: 0,
  reward_item_name: null,
  reward_item_kind: null,
  display_order: 1,
  claimed_at: null,
  is_completed: true,
};

function stubObjectives(
  rows: Array<Omit<typeof finalObjective, "claimed_at"> & { claimed_at: string | null }>,
  careerRows: GameObjectiveRow[] = [],
) {
  mocks.rpc.mockImplementation((name: string) =>
    name === "get_current_cyclo_stickers_reward_objectives"
      ? { abortSignal: async () => ({ data: rows, error: null }) }
      : Promise.resolve({ data: name === "get_current_game_objectives" ? careerRows : [], error: null }),
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

  it("uses the same game date for receipts across server and browser timezones", async () => {
    stubObjectives([{ ...finalObjective, claimed_at: "2026-11-25T23:30:00Z" }]);
    const html = renderToStaticMarkup(await ObjectivesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Récompense récupérée le 26 nov. 2026");
  });

  it("keeps ready career and album rewards first with consistent totals and server forms", async () => {
    stubObjectives([finalObjective], [
      { ...careerObjective, objective_key: "future", title: "Objectif encore en cours", is_completed: false, current_value: 0 },
      careerObjective,
      { ...careerObjective, objective_key: "past", title: "Objectif déjà récupéré", claimed_at: "2026-11-16T10:00:00Z" },
    ]);
    const html = renderToStaticMarkup(await ObjectivesPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("2 récompenses vous attendent");
    expect(html).toContain("Cyclo-Stickers (1)");
    expect(html).toMatch(/Terminés<\/p><p[^>]*>3\/4<\/p>/);
    expect(html).toMatch(/À récupérer<\/p><p[^>]*>2<\/p>/);
    expect(html).toMatch(/Réclamés<\/p><p[^>]*>1<\/p>/);
    expect(html.indexOf("Recruter un premier coureur")).toBeLessThan(html.indexOf("Objectif encore en cours"));
    expect(html.indexOf("Mémoire du peloton")).toBeLessThan(html.indexOf("Objectif encore en cours"));
    expect(html).toContain('name="objectiveKey" value="recruit_first_rider"');
    expect(html).toContain('name="editionId" value="cyclo-stickers-s4-v1"');
    expect(html.match(/Récupérer la récompense/g)).toHaveLength(2);
  });

  it("applies the status, type and group filters while preserving global ready totals", async () => {
    stubObjectives([finalObjective], [careerObjective]);
    const html = renderToStaticMarkup(await ObjectivesPage({
      searchParams: Promise.resolve({ groupe: "transfers", statut: "completed", type: "primary" }),
    }));

    expect(html).toContain("2 récompenses vous attendent");
    expect(html).toContain("1 objectif affiché sur 2");
    expect(html).toContain("Recruter un premier coureur");
    expect(html).not.toContain("Mémoire du peloton");
    expect(html).toContain('name="returnPath" value="/jeu/objectifs?type=primary&amp;statut=completed&amp;groupe=transfers#objectives-list"');
  });

  it.each(ALBUM_ACHIEVEMENTS.map(({ id }) => id))("passes the catalogue key %s verbatim to the claim RPC", async (id) => {
    mocks.rpc.mockResolvedValue({ data: { alreadyClaimed: false }, error: null });
    await expect(claim(id)).rejects.toThrow(/succes=/);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("claim_current_cyclo_stickers_achievement", {
      p_edition: editionId,
      p_achievement_id: id,
    });
  });

  it("rejects an invalid identifier before calling the claim RPC", async () => {
    await expect(claim("profile/timeTrial")).rejects.toThrow(/erreur=/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the existing album claim and refreshes both screens", async () => {
    mocks.rpc.mockResolvedValue({ data: { alreadyClaimed: false }, error: null });
    await expect(claim("count-50")).rejects.toThrow(/redirect:\/jeu\/objectifs\?.+succes=.+#objectives-list/);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("claim_current_cyclo_stickers_achievement", {
      p_edition: editionId,
      p_achievement_id: "count-50",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/objectifs");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu/album");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jeu");
  });
});
