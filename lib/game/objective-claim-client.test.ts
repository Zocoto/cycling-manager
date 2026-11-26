import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { claimRewardObjective } from "./objective-claim-client";
import type { RewardsPageObjective } from "@/services/game-objectives";

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: vi.fn() }));

const owner = "authenticated-owner";
const receivedAt = "2026-11-26T09:18:00+00:00";
function objective(album = false): RewardsPageObjective {
  return {
    key: album ? "album:cyclo-stickers-s4:count-1" : "first_recruitment",
    type: "secondary", group: album ? "cyclo_stickers" : "transfers", title: "Succès",
    description: "", currentValue: 1, targetValue: 1, progressPercent: 100,
    reward: { cash: 1000, experience: 10, reputation: 1, itemName: null, itemKind: null },
    displayOrder: 1, completed: true, claimedAt: null,
    ...(album ? { album: { editionId: "cyclo-stickers-s4", sourceSeason: 4, achievementId: "count-1", trophy: false } } : {}),
  };
}
function query(data: unknown = { claimed_at: receivedAt }) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) };
}
function client() {
  const claimRead = query();
  const albumRead = query();
  const rpc = vi.fn((name: string) => name === "get_current_cyclo_stickers_reward_objectives"
    ? albumRead
    : Promise.resolve({ data: { objectiveKey: "first_recruitment", claimedAt: receivedAt, itemName: "Un objet" }, error: null }));
  const supabase = {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: owner } } }, error: null }) },
    rpc, from: vi.fn().mockReturnValue(claimRead),
  };
  vi.mocked(createSupabaseBrowserClient).mockReturnValue(supabase as unknown as ReturnType<typeof createSupabaseBrowserClient>);
  return { ...supabase, claimRead, albumRead };
}
const albumData = (alreadyClaimed = false) => ({ alreadyClaimed, state: {
  edition: { id: "cyclo-stickers-s4" }, directorId: "director", owner: { directorId: "director" }, claimedAchievements: ["count-1"],
} });

beforeEach(() => vi.clearAllMocks());

describe("interactive objective claim receipts", () => {
  it("confirms a normal reward in one mutation, without loading every objective", async () => {
    const api = client();
    await expect(claimRewardObjective(objective(), owner)).resolves.toEqual({
      objectiveKey: "first_recruitment", claimedAt: receivedAt, alreadyClaimed: false, itemName: "Un objet",
    });
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith("claim_current_game_objective", { p_objective_key: "first_recruitment" });
    expect(api.from).not.toHaveBeenCalled();
  });

  it("waits for the payment receipt before confirming the UI", async () => {
    const api = client();
    let acknowledge!: (result: unknown) => void;
    api.rpc.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }) as never);
    const confirmed = vi.fn();
    const payment = claimRewardObjective(objective(), owner).then(confirmed);
    await vi.waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(1));
    expect(confirmed).not.toHaveBeenCalled();
    acknowledge({ data: { objectiveKey: "first_recruitment", claimedAt: receivedAt }, error: null });
    await payment;
    expect(confirmed).toHaveBeenCalledOnce();
  });

  it.each([{ completed: false }, { claimedAt: receivedAt }])("does not submit an unavailable reward: %s", async patch => {
    const api = client();
    await expect(claimRewardObjective({ ...objective(), ...patch }, owner)).rejects.toThrow("pas disponible");
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("does not claim on an account different from the page owner", async () => {
    const api = client();
    await expect(claimRewardObjective(objective(), "another-account")).rejects.toThrow("session a changé");
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("does not apply a late receipt to another signed-in account", async () => {
    const api = client();
    api.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: owner } } }, error: null })
      .mockResolvedValueOnce({ data: { session: { user: { id: "another-account" } } }, error: null });
    await expect(claimRewardObjective(objective(), owner)).rejects.toThrow("session a changé");
    expect(api.from).not.toHaveBeenCalled();
  });

  it("recovers a duplicate from the actual own receipt, without issuing a second mutation", async () => {
    const api = client();
    api.rpc.mockResolvedValueOnce({ data: null, error: { message: "Déjà récupérée" } } as never);
    await expect(claimRewardObjective(objective(), owner)).resolves.toMatchObject({ claimedAt: receivedAt, alreadyClaimed: true });
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.from).toHaveBeenCalledExactlyOnceWith("game_objective_claims");
    expect(api.claimRead.eq).toHaveBeenCalledWith("objective_key", "first_recruitment");
  });

  it("never interprets an error message as evidence that a reward was paid", async () => {
    const api = client();
    api.rpc.mockResolvedValueOnce({ data: null, error: { message: "La récompense a déjà été récupérée" } } as never);
    api.claimRead.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(claimRewardObjective(objective(), owner)).rejects.toThrow("déjà été récupérée");
  });

  it("rejects an unrelated or malformed response without an authoritative receipt", async () => {
    const api = client();
    api.rpc.mockResolvedValueOnce({ data: { objectiveKey: "other-objective", claimedAt: "invalid" }, error: null } as never);
    api.claimRead.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(claimRewardObjective(objective(), owner)).rejects.toThrow("pas pu être confirmée");
  });

  it("confirms album gains using the existing scoped RPC without opening table permissions", async () => {
    const api = client();
    api.rpc.mockResolvedValueOnce({ data: albumData(), error: null } as never);
    await expect(claimRewardObjective(objective(true), owner)).resolves.toEqual({
      objectiveKey: "album:cyclo-stickers-s4:count-1", claimedAt: receivedAt, alreadyClaimed: false,
    });
    expect(api.rpc).toHaveBeenNthCalledWith(1, "claim_current_cyclo_stickers_achievement", { p_edition: "cyclo-stickers-s4", p_achievement_id: "count-1" });
    expect(api.rpc).toHaveBeenNthCalledWith(2, "get_current_cyclo_stickers_reward_objectives");
    expect(api.albumRead.eq.mock.calls).toEqual([["edition_id", "cyclo-stickers-s4"], ["achievement_id", "count-1"]]);
    expect(api.from).not.toHaveBeenCalled();
  });

  it("keeps the original server date for an album reward already received", async () => {
    const api = client();
    const originalDate = "2026-11-20T11:00:00+00:00";
    api.rpc.mockResolvedValueOnce({ data: albumData(true), error: null } as never);
    api.albumRead.maybeSingle.mockResolvedValueOnce({ data: { claimed_at: originalDate }, error: null });
    await expect(claimRewardObjective(objective(true), owner)).resolves.toMatchObject({ claimedAt: originalDate, alreadyClaimed: true });
  });

  it.each([
    { ...albumData(), state: { ...albumData().state, edition: { id: "another-edition" } } },
    { ...albumData(), state: { ...albumData().state, owner: { directorId: "another-owner" } } },
    { ...albumData(), state: { ...albumData().state, claimedAchievements: [] } },
  ])("does not confirm an album response with a wrong identity or missing claim", async data => {
    const api = client();
    api.rpc.mockResolvedValueOnce({ data, error: null } as never);
    await expect(claimRewardObjective(objective(true), owner)).rejects.toThrow("pas pu être confirmée");
    expect(api.albumRead.maybeSingle).not.toHaveBeenCalled();
  });

  it("recovers a lost album mutation response through its exact own claim", async () => {
    const api = client();
    api.rpc.mockResolvedValueOnce({ data: null, error: { message: "Network unavailable" } } as never);
    await expect(claimRewardObjective(objective(true), owner)).resolves.toMatchObject({ alreadyClaimed: true, claimedAt: receivedAt });
    expect(api.rpc.mock.calls.filter(([name]) => name === "claim_current_cyclo_stickers_achievement")).toHaveLength(1);
  });

  it("keeps an unconfirmed album receipt pending rather than inventing a payment date", async () => {
    const api = client();
    api.rpc.mockResolvedValueOnce({ data: albumData(), error: null } as never);
    api.albumRead.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Read failed" } } as never);
    await expect(claimRewardObjective(objective(true), owner)).rejects.toThrow("pas pu être confirmée");
  });
});
