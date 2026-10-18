import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeNationalJerseyDraft } from "@/lib/game/national-jersey-preview";
import type { GazetteJerseyChangeRow } from "@/lib/game/cyclogazette-jerseys";
import type { CyclogazetteFeatureStory } from "@/lib/game/cyclogazette";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("@/services/public-game-news", () => ({ getCyclogazetteNewsItems: async () => [] }));
vi.mock("@/services/cyclogazette-editorial", () => ({
  loadCyclogazetteFeatureStories: async () => Array.from({ length: 6 }, (_, i): CyclogazetteFeatureStory => ({ id: `story-${i}`, kind: "startlist", kicker: "Start-list", kickerEn: "Start list", title: "Dossier", titleEn: "Feature", body: "Un dossier conservé.", bodyEn: "Preserved story." })),
  loadCyclogazetteNationsCupSpecial: async () => null,
}));
import { getCyclogazetteEditionById, publishCyclogazetteEdition } from "./cyclogazette";

function fixture() {
  let edition: Record<string, unknown> | null = null;
  const rows: GazetteJerseyChangeRow[] = ["national_team", "national_champion"].map(kind => ({ country_id: "country", country_code: "FR", country_name: "France", jersey_kind: kind as GazetteJerseyChangeRow["jersey_kind"], version: 2, design: normalizeNationalJerseyDraft({ baseColor: "#123456" }), previous_design: null, published_at: "2026-10-18T10:00:00Z", rider_id: "rider", rider_name: "Jean Martin", avatar_profile_key: "europe_west", avatar_seed: "123", championship_type: "road" }));
  const rpc = vi.fn(async (name: string) => ({ data: name === "get_cyclogazette_jersey_changes" ? rows : 0, error: null }));
  const inserts = vi.fn();
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain, eq: () => chain, in: () => chain, gte: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
      returns: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: table === "seasons" ? { id: "season", name: "Saison 4", game_year: 4, current_day_number: 10 } : table === "season_days" ? { id: "day", day_number: 10, calendar_date: "2026-10-18" } : edition, error: null }),
      insert: (values: Record<string, unknown>) => { inserts(values); edition = { ...values, id: "77777777-7777-4777-8777-777777777777", season_days: { day_number: 10 } }; return chain; },
      single: async () => ({ data: edition, error: null }),
    };
    return chain;
  });
  mocks.createAdmin.mockReturnValue({ from, rpc });
  return { rows, rpc, inserts };
}

beforeEach(() => vi.clearAllMocks());

describe("édition de gazette avec nouveaux maillots", () => {
  it("archive les deux annonces dans la rubrique générale sans évincer les six autres dossiers", async () => {
    const f = fixture();
    const result = await publishCyclogazetteEdition(new Date("2026-10-18T18:01:00Z"));
    expect(result.status).toBe("published");
    expect(result.edition?.content.featureStories).toHaveLength(8);
    expect(result.edition?.content.featureStories?.slice(-2).map(s => s.kind)).toEqual(["national_team_jersey", "national_champion_jersey"]);
    f.rows[0].design.baseColor = "#ABCDEF";
    const archive = await getCyclogazetteEditionById(result.edition!.id);
    expect(archive?.content.featureStories?.[6].jerseyReveal?.design.baseColor).toBe("#123456");
    expect(f.inserts).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls.filter(([name]) => name === "get_cyclogazette_jersey_changes")).toHaveLength(1);
  });
  it("ne recharge ni ne republie les annonces lors des lectures ou relances de la même édition", async () => {
    const f = fixture();
    await publishCyclogazetteEdition(new Date("2026-10-18T18:01:00Z"));
    const retry = await publishCyclogazetteEdition(new Date("2026-10-18T19:00:00Z"), { force: true });
    expect(retry.status).toBe("already-published");
    expect(f.inserts).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls.filter(([name]) => name === "get_cyclogazette_jersey_changes")).toHaveLength(1);
  });
});
