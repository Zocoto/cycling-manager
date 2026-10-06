import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mock.from, rpc: mock.rpc }) }));
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
  mock.rpc.mockReset();
  mock.rpc.mockImplementation((name: string, params?: { p_team_ids?: string[] }) => Promise.resolve({
    error: null,
    data: name === "get_season_finale_gala_export_context" ? [{ id: "season", game_year: 3 }]
      : (params?.p_team_ids ?? []).map((team_id) => ({ team_id, identity_season: 4,
        team_name: `Identité S4 ${team_id}`, team_short_name: "S4", identity_ready: true })),
  }));
  mock.from.mockImplementation((table: string) => {
    let rows = [...(tables[table] ?? [])];
    let range: [number, number] | null = null;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return query; },
      order: () => query,
      limit: (count: number) => { rows = rows.slice(0, count); return query; },
      single: async () => ({ data: rows[0] ?? null, error: null }),
      returns: () => query,
      range: (from: number, to: number) => { range = [from, to]; return query; },
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: range ? rows.slice(range[0], range[1] + 1) : rows, error: null }).then(resolve),
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
    expect(manifest.events[0].teams[0]).toMatchObject({ team: "Identité S4 team-1", identitySeason: 4 });
    expect(mock.from.mock.calls.every(([table]) => ["seasons", "pcm_gala_events", "pcm_gala_registrations", "team_seasons", "pcm_gala_registration_riders", "teams", "riders"].includes(table))).toBe(true);
  });
  it("préserve l'extraction des trois profils sur l'ancienne page", async () => {
    const result = await generatePcmGalaStartlistExport();
    expect(result).toMatchObject({ eventCount: 3, registeredTeamCount: 3, registeredRiderCount: 21 });
    expect(Object.keys(unzipSync(result.archive)).filter((file) => file.endsWith(".xml"))).toHaveLength(3);
  });
  it("refuse de produire une sélection incomplète", async () => {
    tables.pcm_gala_registration_riders = tables.pcm_gala_registration_riders.filter((row) => !["rider-1-6", "rider-1-5"].includes(String(row.rider_id)));
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
  it("ne remplace jamais une identité future inconnue par l'ancien nom", async () => {
    mock.rpc.mockImplementation((name: string) => Promise.resolve({ error: null,
      data: name === "get_season_finale_gala_export_context" ? [{ id: "season", game_year: 3 }] : [] }));
    await expect(generatePcmGalaStartlistExport("gala-des-puncheurs")).rejects.toThrow("Identité de la saison suivante non confirmée");
  });
  it("conserve les inscriptions S3 pour la vidéo même quand S4 devient active", async () => {
    tables.seasons[0].status = "completed";
    tables.seasons.push({ id: "next", game_year: 4, status: "active" });
    tables.team_seasons.forEach((row) => { row.status = "completed"; });
    const result = await generatePcmGalaStartlistExport("gala-des-puncheurs");
    expect(result).toMatchObject({ season: 3, registeredTeamCount: 1, registeredRiderCount: 7 });
    const manifest = JSON.parse(strFromU8(unzipSync(result.archive)["manifest.json"]));
    expect(manifest.events[0].teams[0]).toMatchObject({ team: "Identité S4 team-1", identitySeason: 4 });
  });
  it.each([6, 7, 8])("exporte une sélection de %i coureurs", async (count) => {
    createFinaleTeams(1, count);
    const result = await generatePcmGalaStartlistExport("gala-des-puncheurs");
    expect(result.registeredRiderCount).toBe(count);
    const files = unzipSync(result.archive);
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    expect(manifest.events[0].teams[0].riders).toHaveLength(count);
  });
  it.each([21, 30, 40, 41, 150, 1001])("exporte %i équipes dans des groupes indépendants, sans troncature", async (count) => {
    createFinaleTeams(count);
    const result = await generatePcmGalaStartlistExport("gala-des-puncheurs");
    const files = unzipSync(result.archive);
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));
    const simulations = Math.ceil(count / 20);
    expect(result).toMatchObject({ eventCount: 1, simulationCount: simulations, registeredTeamCount: count, registeredRiderCount: tables.riders.length });
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.events).toHaveLength(simulations);
    const teamIds: number[] = [];
    for (const [index, event] of manifest.events.entries()) {
      expect(event).toMatchObject({ groupNumber: index + 1, groupCount: simulations, spectatorTeamIncluded: true, file: `Groupe-${index + 1}/topclas_fleche.xml` });
      expect(event.teams.length).toBeLessThanOrEqual(20);
      const xml = strFromU8(files[event.file]);
      expect(xml).toContain('<team id="243">');
      expect(xml.match(/<team id=/g)).toHaveLength(event.teams.length + 1);
      for (const team of event.teams) {
        teamIds.push(team.pcmTeamId);
        expect(team.riders.length).toBeGreaterThanOrEqual(6);
        expect(team.riders.length).toBeLessThanOrEqual(8);
        expect(xml).toContain(`<team id="${team.pcmTeamId}">`);
      }
    }
    expect(teamIds.sort((a, b) => a - b)).toEqual(tables.teams.map((team) => team.pcm_export_id));
    expect(strFromU8(files["LISEZ-MOI.txt"])).toContain("top 5 de CHAQUE groupe");
    expect(strFromU8(files["LISEZ-MOI.txt"])).toContain("Ne renommez pas topclas_fleche.xml");
  });
});

function createFinaleTeams(count: number, fixedRosterSize?: number) {
  tables.pcm_gala_registrations = [];
  tables.pcm_gala_registration_riders = [];
  tables.teams = [];
  tables.team_seasons = [];
  tables.riders = [];
  for (let i = 0; i < count; i++) {
    const teamId = `finale-team-${i}`, registrationId = `finale-registration-${i}`;
    tables.teams.push({ id: teamId, pcm_export_id: 2000 + i });
    tables.team_seasons.push({ team_id: teamId, season_id: "season", status: "active", display_name: `Équipe ${String(i).padStart(5, "0")}` });
    tables.pcm_gala_registrations.push({ id: registrationId, gala_event_id: "event-1", team_id: teamId, season_id: "season" });
    for (let j = 0; j < (fixedRosterSize ?? 6 + i % 3); j++) {
      const riderId = `finale-rider-${i}-${j}`;
      tables.pcm_gala_registration_riders.push({ registration_id: registrationId, rider_id: riderId, position: j + 1 });
      tables.riders.push({ id: riderId, pcm_export_id: 20000 + i * 8 + j, first_name: "Coureur", last_name: `${i}-${j}` });
    }
  }
}
