import { afterEach, describe, expect, it, vi } from "vitest";

import belgianNames from "@/data/rider-names/belgium.json";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentEmptyRosterRecoveryState,
  recoverCurrentEmptyTeamRoster,
  type EmptyRosterRecoveryState,
} from "./empty-roster-recovery";

const state = {
  available: true,
  team_country_id: "11111111-1111-4111-8111-111111111111",
  team_country_name: "France",
  team_country_iso_alpha2: "FR",
  name_profile_code: "france",
  recovered_this_season: false,
  has_committed_riders: false,
} satisfies EmptyRosterRecoveryState & { has_committed_riders: boolean };

function client({
  current = state,
  readError = null,
  mutationData = { status: "created", rider_count: 7 },
  mutationError = null,
}: {
  current?: EmptyRosterRecoveryState | null;
  readError?: { message: string } | null;
  mutationData?: unknown;
  mutationError?: { message: string; code: string } | null;
} = {}) {
  const rpc = vi.fn<(name: string, params?: unknown) => unknown>((name) => {
    if (name === "get_current_empty_roster_recovery_state") {
      return { maybeSingle: vi.fn().mockResolvedValue({ data: current, error: readError }) };
    }
    if (name === "recover_current_empty_team_roster") {
      return Promise.resolve({ data: mutationData, error: mutationError });
    }
    throw new Error(`Unexpected recovery RPC: ${name}`);
  });
  return { rpc, supabase: { rpc } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>> };
}

afterEach(() => vi.restoreAllMocks());

describe("empty-team recovery service", () => {
  it("reads the authenticated team's eligibility without a client-supplied team identifier", async () => {
    const mock = client();
    expect(await getCurrentEmptyRosterRecoveryState(mock.supabase)).toEqual(state);
    expect(mock.rpc.mock.calls).toEqual([["get_current_empty_roster_recovery_state"]]);
  });

  it("preserves the absent-team state", async () => {
    expect(await getCurrentEmptyRosterRecoveryState(client({ current: null }).supabase)).toBeNull();
  });

  it("fails closed on an eligibility read error without exposing database details", async () => {
    const mock = client({ readError: { message: "private SQL diagnostic" } });
    await expect(recoverCurrentEmptyTeamRoster(mock.supabase)).rejects.toThrow("La possibilité de relancer votre effectif");
    expect(mock.rpc.mock.calls).toEqual([["get_current_empty_roster_recovery_state"]]);
  });

  it("generates exactly seven starter identities using the team's current country", async () => {
    const mock = client();
    expect(await recoverCurrentEmptyTeamRoster(mock.supabase)).toBe("created");
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    expect(mock.rpc).toHaveBeenLastCalledWith("recover_current_empty_team_roster", {
      p_expected_country_id: state.team_country_id,
      p_rider_identities: expect.any(Array),
    });
    const submitted = mock.rpc.mock.calls[1][1] as unknown as {
      p_expected_country_id: string;
      p_rider_identities: Array<{ first_name: string; last_name: string; avatar_seed: string }>;
    };
    expect(submitted.p_rider_identities).toHaveLength(7);
    expect(new Set(submitted.p_rider_identities.map(rider => rider.avatar_seed)).size).toBe(7);
    for (const rider of submitted.p_rider_identities) {
      expect(Object.keys(rider).sort()).toEqual(["avatar_seed", "first_name", "last_name"]);
      expect(rider.first_name.trim()).not.toBe("");
      expect(rider.last_name.trim()).not.toBe("");
    }
  });

  it("uses the latest country snapshot rather than a previous country", async () => {
    const current = { ...state, team_country_id: "22222222-2222-4222-8222-222222222222", team_country_name: "Belgique", team_country_iso_alpha2: "BE", name_profile_code: "belgium" };
    const mock = client({ current });
    await recoverCurrentEmptyTeamRoster(mock.supabase);
    expect(mock.rpc).toHaveBeenLastCalledWith("recover_current_empty_team_roster", expect.objectContaining({
      p_expected_country_id: current.team_country_id,
    }));
    const submitted = mock.rpc.mock.calls[1][1] as { p_rider_identities: Array<{ first_name: string; last_name: string }> };
    for (const rider of submitted.p_rider_identities) {
      expect(belgianNames.firstNames).toContain(rider.first_name);
      expect(belgianNames.lastNames).toContain(rider.last_name);
    }
  });

  it.each([
    null,
    { ...state, available: false, has_committed_riders: true },
    { ...state, name_profile_code: "" },
  ])("does not submit a mutation when recovery is unavailable (%j)", async current => {
    const mock = client({ current });
    await expect(recoverCurrentEmptyTeamRoster(mock.supabase)).rejects.toThrow("La relance est réservée");
    expect(mock.rpc.mock.calls).toEqual([["get_current_empty_roster_recovery_state"]]);
  });

  it("explains the seasonal limit without another grant", async () => {
    const mock = client({ current: { ...state, available: false, recovered_this_season: true } });
    await expect(recoverCurrentEmptyTeamRoster(mock.supabase)).rejects.toThrow("déjà été utilisée cette saison");
    expect(mock.rpc).toHaveBeenCalledOnce();
  });

  it("reports a failed mutation without pretending that riders were created", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const mock = client({ mutationData: null, mutationError: { code: "P0001", message: "Country changed under lock" } });
    await expect(recoverCurrentEmptyTeamRoster(mock.supabase)).rejects.toThrow("Votre effectif n’a pas pu être relancé");
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith("empty_roster_recovery_failed", { code: "P0001", message: "Country changed under lock" });
  });

  it("accepts an idempotent acknowledgement from SQL", async () => {
    const mock = client({ mutationData: { status: "already_recovered", rider_count: 7 } });
    expect(await recoverCurrentEmptyTeamRoster(mock.supabase)).toBe("already_recovered");
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });

  it.each([null, {}, { status: "invalid", rider_count: 7 }])("does not claim success for an unrecognized RPC result (%j)", async mutationData => {
    await expect(recoverCurrentEmptyTeamRoster(client({ mutationData }).supabase)).rejects.toThrow("Le résultat de la relance est indisponible");
  });
});
