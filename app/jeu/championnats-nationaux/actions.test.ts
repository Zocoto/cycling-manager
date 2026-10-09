import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string): never => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));

import { saveNationalChampionshipSelectionsAction, withdrawNationalChampionshipRiderAction } from "./actions";

const riderId = "00000000-0000-4000-8000-000000000001";
const editionId = "00000000-0000-4000-8000-000000000002";
const grid = () => { const data = new FormData(); data.append("riderId", riderId); return data; };
const withdrawal = () => { const data = new FormData(); data.set("riderId", riderId); data.set("editionId", editionId); data.set("discipline", "route"); return data; };

describe("CN withdrawals and fresh race availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ data: { user: { id: "manager" } }, error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });
  it("saves both deselected disciplines and refreshes race pages", async () => {
    await expect(saveNationalChampionshipSelectionsAction(grid())).rejects.toThrow("REDIRECT:/jeu/championnats-nationaux?enregistrement=confirme");
    expect(mocks.rpc).toHaveBeenCalledWith("save_current_team_national_championship_selections", { p_selections: [{ rider_id: riderId, road: false, time_trial: false }] });
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/courses/[slug]", "page");
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/calendrier");
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/championnats-nationaux/[discipline]", "page");
  });
  it("refreshes availability after an individual withdrawal too", async () => {
    await withdrawNationalChampionshipRiderAction(withdrawal());
    expect(mocks.rpc).toHaveBeenCalledWith("withdraw_current_team_national_championship_rider", { p_race_edition_id: editionId, p_rider_id: riderId });
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/courses/[slug]", "page");
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/calendrier");
  });
  it.each([saveNationalChampionshipSelectionsAction, withdrawNationalChampionshipRiderAction])("does not report a failed withdrawal as saved", async (action) => {
    mocks.rpc.mockResolvedValue({ error: { message: "Championship already started" } });
    await expect(action(action === saveNationalChampionshipSelectionsAction ? grid() : withdrawal())).rejects.toThrow("Championship already started");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each([saveNationalChampionshipSelectionsAction, withdrawNationalChampionshipRiderAction])("requires an authenticated manager", async (action) => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    await expect(action(action === saveNationalChampionshipSelectionsAction ? grid() : withdrawal())).rejects.toThrow("connecté");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
