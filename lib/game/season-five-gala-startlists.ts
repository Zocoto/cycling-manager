import nativeProfiles from "./season-five-gala-profiles.json";
import { GALA_S5_COURSES, SEASON_FIVE_GALA, type SeasonFiveGalaProgram } from "./season-five-gala";
import { createPcmStartlistXml, PCM_FIRST_CLUB_RIDER_ID, PCM_SPECTATOR_RIDER_IDS, PCM_SPECTATOR_TEAM_ID } from "./pcm-gala-startlists";
import type { ContractRow, PcmExportSnapshot, SeasonRow } from "./pcm-export/types";
import type { SeasonFinaleGalaIdentity } from "@/services/season-finale-gala-identity";

export type SeasonFiveGalaExportEvent = {
  edition_id: string; event_key: string; program: SeasonFiveGalaProgram;
  pcm_race_id: number; pcm_stage_id: number; stage_file: string; startlist_filename: string;
  native_capacity: number; min_riders: number; max_riders: number;
};
export type SeasonFiveGalaExportSource = {
  edition: { id: string; source_season_id: string; target_game_year: number; registration_closes_at: string; status: string };
  events: SeasonFiveGalaExportEvent[];
  entries: { id: string; team_id: string; auth_user_id: string; program: SeasonFiveGalaProgram }[];
  selections: { entry_id: string; edition_id: string; event_key: string; program: SeasonFiveGalaProgram; rider_id: string; position: number }[];
  admissions: { entry_id: string; rider_id: string; primary_snapshot: Record<string, unknown> }[];
  identities: SeasonFinaleGalaIdentity[];
};

export function getSeasonFiveGalaRegisteredClubs(source: SeasonFiveGalaExportSource) {
  const entries = new Map(source.entries.map(row => [row.id, row]));
  const owners = new Map<string, string>();
  for (const selection of source.selections) {
    const entry = entries.get(selection.entry_id);
    if (!entry || selection.edition_id !== source.edition.id || selection.program !== entry.program) throw new Error("Invalid S5 gala selection ownership.");
    const previous = owners.get(selection.rider_id);
    if (previous && previous !== entry.team_id) throw new Error("A gala rider is registered for multiple clubs.");
    owners.set(selection.rider_id, entry.team_id);
  }
  return owners;
}

/** Source-season contracts, including a registered rider released after signing up. */
export function selectSeasonFiveGalaContracts(contracts: ContractRow[], seasons: Pick<SeasonRow, "id" | "game_year">[], registeredClubs: ReadonlyMap<string, string>) {
  const years = new Map(seasons.map(season => [season.id, season.game_year]));
  const eligible = contracts.filter(contract =>
    (["active", "completed"].includes(contract.status) || (contract.status === "terminated" && registeredClubs.get(contract.rider_id) === contract.team_id)) &&
    (years.get(contract.start_season_id) ?? Infinity) <= 5 && (years.get(contract.end_season_id) ?? -Infinity) >= 5 &&
    (!contract.left_season_id || (years.get(String(contract.left_season_id)) ?? -Infinity) > 5 ||
      (registeredClubs.get(contract.rider_id) === contract.team_id && (years.get(String(contract.left_season_id)) ?? -Infinity) >= 5)));
  eligible.sort((a, b) => (years.get(b.start_season_id) ?? 0) - (years.get(a.start_season_id) ?? 0) ||
    Number(b.joined_day_number ?? 1) - Number(a.joined_day_number ?? 1) || String(b.signed_at ?? "").localeCompare(String(a.signed_at ?? "")) || a.id.localeCompare(b.id));
  return [...new Map(eligible.reverse().map(contract => [contract.rider_id, contract])).values()].map(contract => {
    const team = registeredClubs.get(contract.rider_id);
    return team && team !== contract.team_id ? { ...contract, team_id: team } : contract;
  });
}

export function buildSeasonFiveGalaStartlists(source: SeasonFiveGalaExportSource, snapshot: PcmExportSnapshot, databaseSha256: string) {
  if (snapshot.galaEdition !== "season-five" || snapshot.activeSeason.game_year !== 5 || snapshot.activeSeason.id !== source.edition.source_season_id || source.edition.target_game_year !== 6) throw new Error("S5 gala requires its S5 source database and S6 identities.");
  if (!/^[a-f0-9]{64}$/.test(databaseSha256)) throw new Error("Missing exact gala database fingerprint.");
  if (!source.entries.length || !source.selections.length) throw new Error("No S5 gala registrations to export.");
  const entries = new Map(source.entries.map(entry => [entry.id, entry]));
  if (entries.size !== source.entries.length || new Set(source.entries.map(entry => entry.team_id)).size !== entries.size || new Set(source.entries.map(entry => entry.auth_user_id)).size !== entries.size) throw new Error("Duplicate S5 gala registration.");
  const owners = getSeasonFiveGalaRegisteredClubs(source);
  const contracts = new Map(snapshot.contracts.map(contract => [contract.rider_id, contract]));
  const teams = new Map(snapshot.teams.map(team => [team.id, team]));
  const teamNames = new Map(snapshot.teamSeasons.map(team => [team.team_id, team.display_name]));
  const riders = new Map(snapshot.riders.map(rider => [rider.id, rider]));
  const ratings = new Map(snapshot.ratings.map(rating => [rating.rider_id, rating]));
  const identities = new Map(source.identities.map(identity => [identity.team_id, identity]));
  const admissions = new Map(source.admissions.map(admission => [`${admission.entry_id}:${admission.rider_id}`, admission]));
  const events = new Map(source.events.map(event => [event.event_key, event]));
  if (events.size !== 6 || source.events.length !== 6) throw new Error("The S5 gala must contain six distinct courses.");
  const selections = new Map<string, typeof source.selections>();
  const primaryKeys = ["mountain", "hills", "flat", "time_trial", "cobbles", "sprint"];
  for (const row of source.selections) {
    const entry = entries.get(row.entry_id)!;
    const course = GALA_S5_COURSES.find(course => course.id === row.event_key);
    if (!course || course.program !== entry.program) throw new Error("Gala lineup belongs to another programme.");
    const admission = admissions.get(`${row.entry_id}:${row.rider_id}`);
    if (!admission || (entry.program === "continental" && primaryKeys.some(key => !Number.isFinite(Number(admission.primary_snapshot[key])) || Number(admission.primary_snapshot[key]) < 1 || Number(admission.primary_snapshot[key]) > 75))) throw new Error("Missing valid Continental admission at registration.");
    if (contracts.get(row.rider_id)?.team_id !== owners.get(row.rider_id) || !riders.has(row.rider_id) || !ratings.has(row.rider_id)) throw new Error("A registered rider is absent from the exact gala database.");
    const list = selections.get(`${row.entry_id}:${row.event_key}`) ?? [];
    list.push(row); selections.set(`${row.entry_id}:${row.event_key}`, list);
  }
  for (const entry of source.entries) {
    const identity = identities.get(entry.team_id);
    if (!identity?.identity_ready || identity.identity_season !== 6 || identity.team_name !== teamNames.get(entry.team_id)) throw new Error("A registered team's S6 identity is not confirmed in this database.");
    if (!source.selections.some(row => row.entry_id === entry.id)) throw new Error("An S5 gala entry has no selected race.");
  }
  const files: Record<string, string> = {};
  const manifests: Record<string, unknown>[] = [];
  for (const course of GALA_S5_COURSES) {
    const event = events.get(course.id);
    const native = nativeProfiles.courses[course.id as keyof typeof nativeProfiles.courses];
    if (!event || event.edition_id !== source.edition.id || event.program !== course.program ||
      event.pcm_race_id !== native.pcmRaceId || event.pcm_stage_id !== native.pcmStageId || event.stage_file !== native.stageFile ||
      event.startlist_filename !== native.startlistFilename || event.native_capacity !== native.nativeCapacity || event.min_riders !== 7 || event.max_riders !== 8) throw new Error("S5 gala course metadata differs from the verified native profile.");
    const selectedEntries = source.entries.filter(entry => selections.has(`${entry.id}:${course.id}`)).sort((a, b) =>
      teamNames.get(a.team_id)!.localeCompare(teamNames.get(b.team_id)!, "fr") || a.team_id.localeCompare(b.team_id));
    if (!selectedEntries.length) continue;
    const capacity = event.native_capacity - 1;
    const count = Math.ceil(selectedEntries.length / capacity);
    const groups = Array.from({ length: count }, () => [] as typeof selectedEntries);
    selectedEntries.forEach((entry, index) => groups[index % count].push(entry));
    for (const [index, group] of groups.entries()) {
      const xmlTeams = [{ teamId: PCM_SPECTATOR_TEAM_ID, riderIds: [...PCM_SPECTATOR_RIDER_IDS] as number[] }];
      const manifestTeams = group.map(entry => {
        const team = teams.get(entry.team_id);
        if (!team || !Number.isSafeInteger(team.pcm_export_id) || team.pcm_export_id <= PCM_SPECTATOR_TEAM_ID) throw new Error("Missing permanent gala team PCM identifier.");
        const selected = [...selections.get(`${entry.id}:${course.id}`)!].sort((a, b) => a.position - b.position);
        if (selected.length < SEASON_FIVE_GALA.minRiders || selected.length > SEASON_FIVE_GALA.maxRiders || selected.some((row, position) => row.position !== position + 1)) throw new Error("Gala rosters require 7–8 riders with contiguous positions.");
        const selectedRiders = selected.map(row => riders.get(row.rider_id)!);
        if (selectedRiders.some(rider => !Number.isSafeInteger(rider.pcm_export_id) || rider.pcm_export_id < PCM_FIRST_CLUB_RIDER_ID)) throw new Error("Missing permanent gala rider PCM identifier.");
        xmlTeams.push({ teamId: team.pcm_export_id, riderIds: selectedRiders.map(rider => rider.pcm_export_id) });
        return { teamId: entry.team_id, team: teamNames.get(entry.team_id), pcmTeamId: team.pcm_export_id, identitySeason: 6,
          riders: selected.map(row => ({ riderId: row.rider_id, pcmRiderId: riders.get(row.rider_id)!.pcm_export_id, position: row.position })) };
      });
      const folder = course.program === "pro-tour" ? "Pro-Tour" : "Continental";
      const filename = `${folder}/${count > 1 ? `Groupe-${index + 1}/` : ""}${event.startlist_filename}`;
      files[filename] = createPcmStartlistXml(xmlTeams);
      manifests.push({ editionId: source.edition.id, eventKey: course.id, programme: course.program, raceId: event.pcm_race_id, stageId: event.pcm_stage_id,
        stageFile: event.stage_file, file: filename, groupNumber: index + 1, groupCount: count, nativeCapacity: event.native_capacity,
        clubCapacity: capacity, spectatorTeamIncluded: true, minRiders: 7, maxRiders: 8, teams: manifestTeams });
    }
  }
  return { files, manifest: { formatVersion: 1, galaEdition: "season-five", editionId: source.edition.id, sourceSeason: 5, identitySeason: 6,
    databaseSha256, snapshotSha256: snapshot.sha256, ratingPolicy: "S5 native ratings, no bonuses, no Continental clipping", events: manifests } };
}
