import { describe, expect, it, vi } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPcmGalaRegistrationContext } from "./pcm-gala-registration";

describe("liste publique des engagés du gala", () => {
  it("charge toutes les pages sans perdre les équipes après 1000 coureurs", async () => {
    const rows = Array.from({ length: 150 * 8 }, (_, index) => ({
      event_key: "gala-des-puncheurs", team_id: `team-${Math.floor(index / 8)}`, team_name: `Équipe ${Math.floor(index / 8)}`,
      team_short_name: "GAL", team_country_code: "fr", rider_id: `rider-${index}`, rider_first_name: "Coureur", rider_last_name: String(index),
      rider_country_code: "fr", rider_position: index % 8 + 1, registered_at: "2026-10-06T12:00:00Z",
    }));
    const range = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    const rpc = vi.fn((name: string) => name === "get_pcm_gala_public_startlists" ? { range } : Promise.resolve({ data: [], error: null }));
    const result = await getPcmGalaRegistrationContext({ rpc } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(result.publicStartlists["gala-des-puncheurs"]).toHaveLength(150);
    expect(result.publicStartlists["gala-des-puncheurs"]?.every((team) => team.riders.length === 8)).toBe(true);
  });
  it("remonte une erreur de pagination au lieu d'afficher une liste tronquée", async () => {
    const rpc = vi.fn((name: string) => name === "get_pcm_gala_public_startlists"
      ? { range: async () => ({ data: null, error: { message: "indisponible" } }) }
      : Promise.resolve({ data: [], error: null }));
    await expect(getPcmGalaRegistrationContext({ rpc } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>)).rejects.toThrow("Impossible de charger les engagés gala");
  });
});
