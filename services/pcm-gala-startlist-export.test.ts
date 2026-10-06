import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mock.from }) }));
import { generatePcmGalaStartlistExport } from "./pcm-gala-startlist-export";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
beforeEach(() => {
  const keys = ["gala-des-sommets", "gala-des-puncheurs", "gala-des-sprinteurs"];
  tables = {
    seasons: [{ id: "season", game_year: 3, status: "active" }],
    pcm_gala_events: keys.map((event_key, i) => ({ id: `event-${i}`, season_id: "season", event_key, display_name: event_key, pcm_stage_filename: ["topclas_lombardia", "topclas_fleche", "c0_paristours"][i], roster_size: 7, sort_order: i })),
    pcm_gala_registrations: keys.map((_, i) => ({ id: `registration-${i}`, gala_event_id: `event-${i}`, team_id: `team-${i}`, season_id: "season" })),
    pcm_gala_registration_riders: keys.flatMap((_, i) => Array.from({ length: 7 }, (_, j) => ({ registration_id: `registration-${i}`, rider_id: `rider-${i}-${j}`, position: j + 1 }))),
    teams: keys.map((_, i) => ({ id: `team-${i}`, pcm_export_id: 244 + i })),
    team_seasons: keys.map((_, i) => ({ team_id: `team-${i}`, season_id: "season", status: "active", display_name: `Équipe ${i}` })),
    riders: keys.flatMap((_, i) => Array.from({ length: 7 }, (_, j) => ({ id: `rider-${i}-${j}`, pcm_export_id: 10001 + i * 7 + j, first_name: "Coureur", last_name: `${i}-${j}` }))),
  };
  mock.from.mockReset();
  mock.from.mockImplementation((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return query; },
      order: () => query,
      limit: (count: number) => { rows = rows.slice(0, count); return query; },
      single: async () => ({ data: rows[0] ?? null, error: null }),
      returns: async () => ({ data: rows, error: null }),
    };
    return query;
  });
});

describe("export PCM du gala, données simulées uniquement", () => {
  it("exporte un seul XML vallonné, avec spectateur et sept coureurs, et des compteurs filtrés", async () => {
    const result = await generatePcmGalaStartlistExport("gala-des-puncheurs");
    const files = unzipSync(result.archive);
    expect(Object.keys(files).sort()).toEqual(["LISEZ-MOI.txt", "manifest.json", "topclas_fleche.xml"]);
    expect(result).toMatchObject({ eventCount: 1, registeredTeamCount: 1, registeredRiderCount: 7, filename: "Cyclostratege-Startlists-PCM26-S3-gala-des-puncheurs.zip" });
    const xml = strFromU8(files["topclas_fleche.xml"]);
    expect(xml).toContain('<team id="243">');
    expect(xml).toContain('<team id="245">');
    expect(xml).toContain('<cyclist id="10008" />');
    expect(xml).not.toContain('<team id="244">');
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    expect(manifest.events).toHaveLength(1);
    expect(manifest.events[0].teams[0].riders).toHaveLength(7);
    expect(mock.from.mock.calls.every(([table]) => ["seasons", "pcm_gala_events", "pcm_gala_registrations", "team_seasons", "pcm_gala_registration_riders", "teams", "riders"].includes(table))).toBe(true);
  });
  it("préserve l'extraction des trois profils sur l'ancienne page", async () => {
    const result = await generatePcmGalaStartlistExport();
    expect(result).toMatchObject({ eventCount: 3, registeredTeamCount: 3, registeredRiderCount: 21 });
    expect(Object.keys(unzipSync(result.archive)).filter((file) => file.endsWith(".xml"))).toHaveLength(3);
  });
  it("refuse de produire une sélection incomplète", async () => {
    tables.pcm_gala_registration_riders = tables.pcm_gala_registration_riders.filter((row) => row.rider_id !== "rider-1-6");
    await expect(generatePcmGalaStartlistExport("gala-des-puncheurs")).rejects.toThrow("Sélection incomplète");
  });
  it("refuse un identifiant PCM permanent manquant", async () => {
    tables.riders[7].pcm_export_id = undefined;
    await expect(generatePcmGalaStartlistExport("gala-des-puncheurs")).rejects.toThrow("Identifiant PCM absent");
  });
  it("refuse une course non configurée au lieu d'exporter un autre profil", async () => {
    tables.pcm_gala_events = tables.pcm_gala_events.filter((row) => row.event_key !== "gala-des-puncheurs");
    await expect(generatePcmGalaStartlistExport("gala-des-puncheurs")).rejects.toThrow("Aucune course gala");
  });
});
