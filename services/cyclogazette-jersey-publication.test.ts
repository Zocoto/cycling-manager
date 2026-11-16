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

function fixture({ gameYear = 4, dayNumber = 10, calendarDate = "2026-10-18", hostingDecisions = [] as unknown[] } = {}) {
  let edition: Record<string, unknown> | null = null;
  const rows: GazetteJerseyChangeRow[] = ["national_team", "national_champion"].map(kind => ({ country_id: "country", country_code: "FR", country_name: "France", jersey_kind: kind as GazetteJerseyChangeRow["jersey_kind"], version: 2, design: normalizeNationalJerseyDraft({ baseColor: "#123456" }), previous_design: null, published_at: "2026-10-18T10:00:00Z", rider_id: "rider", rider_name: "Jean Martin", avatar_profile_key: "europe_west", avatar_seed: "123", championship_type: "road" }));
  const rpc = vi.fn(async (name: string) => ({ data: name === "get_cyclogazette_jersey_changes" ? rows : name === "get_cyclogazette_human_race_editions" ? [] : 0, error: null }));
  const inserts = vi.fn();
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain, eq: () => chain, in: () => chain, gte: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
      returns: async () => ({ data: table === "national_federation_hosting_decisions" ? hostingDecisions : [], error: null }),
      maybeSingle: async () => ({ data: table === "seasons" ? { id: "season", name: `Saison ${gameYear}`, game_year: gameYear, current_day_number: dayNumber } : table === "season_days" ? { id: "day", day_number: dayNumber, calendar_date: calendarDate } : edition, error: null }),
      insert: (values: Record<string, unknown>) => { inserts(values); edition = { ...values, id: "77777777-7777-4777-8777-777777777777", season_days: { day_number: dayNumber } }; return chain; },
      single: async () => ({ data: edition, error: null }),
    };
    return chain;
  });
  mocks.createAdmin.mockReturnValue({ from, rpc });
  return { rows, rpc, from, inserts };
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

it("archives the hosting announcement once alongside the existing Gazette features", async () => {
  const decision = {
    target_game_year: 6, event_key: "world_championship_pro", event_type: "world_championship_pro",
    continent_code: null, decision: "hosted", countries: { name: "Belgique", iso_alpha2: "BE" },
  };
  const f = fixture({ gameYear: 5, dayNumber: 21, calendarDate: "2026-11-26", hostingDecisions: [decision] });
  const issue = await publishCyclogazetteEdition(new Date("2026-11-26T19:01:00Z"));
  expect(issue.status).toBe("published");
  expect(issue.edition?.content.featureStories?.[0]).toMatchObject({ kind: "federation_hosting", hostingDecisions: [{ hostName: "Belgique" }] });
  expect(issue.edition?.content.featureStories).toHaveLength(9);

  decision.countries.name = "France";
  const retry = await publishCyclogazetteEdition(new Date("2026-11-26T19:11:00Z"));
  expect(retry.status).toBe("already-published");
  expect(retry.edition?.content.featureStories?.[0].hostingDecisions?.[0].hostName).toBe("Belgique");
  expect(f.inserts).toHaveBeenCalledTimes(1);
  expect(f.from.mock.calls.filter(([table]) => table === "national_federation_hosting_decisions")).toHaveLength(1);
});
